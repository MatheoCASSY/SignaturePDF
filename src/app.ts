import { checkTemplate, cloneDeep, getDefaultFont, getInputFromTemplate, type Template } from '@pdfme/common';
import { DESIGNER_OPTIONS, FORM_OPTIONS, uiPlugins } from './config/ui';
import { sampleTemplates } from './data/templates';
import { appendFieldFromDesigner } from './core/fields';
import { generateFillablePdf } from './core/fillablePdf';
import {
  loadInputs,
  loadLang,
  loadRoute,
  loadTemplate,
  loadTodos,
  persistInputs,
  persistLang,
  persistTemplate,
  persistTodos,
  loadAuthToken,
  loadRemoteTemplateId,
  loadTemplateName,
  persistAuthToken,
  persistRemoteTemplateId,
  persistTemplateName,
} from './core/storage';
import { summarizeTemplate } from './core/template';
import { fillTemplateDefaults } from './core/template';
import {
  checkRemoteAccess,
  consumeRemoteAccess,
  grantRemoteAccess,
  loadRemoteTemplate,
  loadRemoteInbox,
  loadRemoteUserDirectory,
  loadRemoteTemplates,
  saveRemoteTemplate,
} from './core/remote';
import {
  clearOidcSession,
  getStoredAuthSession,
  hydrateAuthSession,
  startCognitoLogoutRedirect,
  startSigninRedirect,
  toAuthSnapshot,
} from './core/auth';
import { renderAppShell } from './components/layout';
import { getTodoProgress, renderTodoItems } from './components/todo';
import { downloadBinary, downloadJson, readFileAsDataUrl, readJsonFile } from './utils/files';
import { parseRoute, routePath } from './utils/routing';
import { escapeHtml } from './utils/dom';
import type { AppState, AuthViewState, FieldKind, NoticeTone, RouteName } from './types/app';
import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Application container not found');
}

const state: AppState = {
  route: loadRoute(),
  template: loadTemplate(),
  inputs: [],
  lang: loadLang(),
  notices: [],
  todos: loadTodos(),
  templateDraft: '',
  inputsDraft: '',
  authToken: loadAuthToken(),
  remoteTemplateId: loadRemoteTemplateId(),
  templateName: loadTemplateName(),
  remoteTemplates: [],
  remoteAccess: null,
  remoteInbox: [],
  remoteUsers: [],
  selectedAccessPrincipals: [],
  userDirectoryQuery: '',
  selectedInboxTemplateId: '',
  adminAccessMaxUses: 1,
};

state.inputs = loadInputs(state.template);
state.templateDraft = JSON.stringify(state.template, null, 2);
state.inputsDraft = JSON.stringify(state.inputs, null, 2);

type DesignerLike = {
  destroy: () => void;
  getTemplate: () => Template;
  updateTemplate: (template: Template) => void;
  getPageCursor?: () => number;
  onSaveTemplate: (callback: (template: Template) => void) => void;
  onChangeTemplate: (callback: (template: Template) => void) => void;
  onPageChange: (callback: (detail: { currentPage: number; totalPages: number }) => void) => void;
};

type FormLike = {
  destroy: () => void;
  getTemplate: () => Template;
  getInputs: () => Record<string, string>[];
  onChangeInput: (callback: (detail: { index: number; name: string; value: string }) => void) => void;
  onPageChange: (callback: (detail: { currentPage: number; totalPages: number }) => void) => void;
};

let activeUi: DesignerLike | FormLike | null = null;
let activeUiKind: RouteName | null = null;
let mountRequestId = 0;
let uiModulePromise: Promise<{ Designer: new (...args: any[]) => unknown; Form: new (...args: any[]) => unknown }> | null = null;
let generatorModulePromise: Promise<{ generate: (...args: any[]) => Promise<any> }> | null = null;

const PDFME_UI_CDN_URL = 'https://esm.sh/@pdfme/ui@6.0.6?bundle';
const PDFME_GENERATOR_CDN_URL = 'https://esm.sh/@pdfme/generator@6.0.6?bundle';

const authView: AuthViewState = {
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,
  email: '',
  expiresAt: null,
};

function loadUiModule() {
  if (!uiModulePromise) {
    uiModulePromise = import(/* @vite-ignore */ PDFME_UI_CDN_URL).then((module) => ({
      Designer: module.Designer,
      Form: module.Form,
    }));
  }
  return uiModulePromise;
}

function loadGeneratorModule() {
  if (!generatorModulePromise) {
    generatorModulePromise = import(/* @vite-ignore */ PDFME_GENERATOR_CDN_URL).then((module) => ({
      generate: module.generate,
    }));
  }
  return generatorModulePromise;
}

async function startup() {
  await bootstrapAuth();
  syncRouteFromLocation();
  hydrateTemplateIdFromUrl();
  syncAuthState();
  ensureRoute();
  renderShell();
  void mountUi();
  syncEditors();
  refreshSummary();
  refreshTodoPanel();
  refreshNotices();
  void refreshRouteData();
  window.addEventListener('popstate', onLocationChange);
}

function syncRouteFromLocation() {
  state.route = parseRoute(location.pathname);
}

function hydrateTemplateIdFromUrl() {
  const query = new URLSearchParams(window.location.search);
  const templateId = query.get('templateId');
  if (!templateId) return;

  state.remoteTemplateId = templateId;
  persistRemoteTemplateId(templateId);
}

async function bootstrapAuth() {
  try {
    const user = await hydrateAuthSession();
    const snapshot = toAuthSnapshot(user);
    authView.isAuthenticated = snapshot.isAuthenticated;
    authView.isAdmin = snapshot.isAdmin;
    authView.email = snapshot.email;
    authView.expiresAt = snapshot.expiresAt;

    if (snapshot.accessToken) {
      state.authToken = snapshot.accessToken;
      persistAuthToken(state.authToken);
    }
  } catch (error) {
    pushNotice(`Authentification Cognito indisponible: ${(error as Error).message}`, 'warning');
  } finally {
    authView.isLoading = false;
  }
}

function onLocationChange() {
  const nextRoute = parseRoute(location.pathname);
  if (nextRoute !== state.route) {
    state.route = nextRoute;
    syncAuthState();
    ensureRoute();
    renderShell();
    void mountUi();
    syncEditors();
    refreshSummary();
    refreshTodoPanel();
    refreshNotices();
    void refreshRouteData();
  }
}

function renderShell() {
  const summary = summarizeTemplate(state.template);
  app.innerHTML = renderAppShell({
    route: state.route,
    pageCount: summary.pageCount,
    fieldCount: summary.fieldCount,
    progress: getTodoProgress(state.todos),
    auth: authView,
  });

  bindShellEvents();
}

function bindShellEvents() {
  document.querySelectorAll<HTMLAnchorElement>('[data-route-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const route = link.dataset.routeLink as RouteName | undefined;
      if (!route || route === state.route) return;
      navigateTo(route);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.dataset.action;
      if (!action) return;
      await handleAction(action, button);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-field-kind]').forEach((button) => {
    button.addEventListener('click', () => {
      const kind = button.dataset.fieldKind as FieldKind | undefined;
      if (!kind) return;
      appendField(kind);
    });
  });

  const templateInput = document.querySelector<HTMLInputElement>('#template-file');
  const basePdfInput = document.querySelector<HTMLInputElement>('#basepdf-file');
  const inputsInput = document.querySelector<HTMLInputElement>('#inputs-file');
  const authTokenInput = document.querySelector<HTMLInputElement>('#auth-token');
  const templateNameInput = document.querySelector<HTMLInputElement>('#template-name');
  const remoteTemplateInput = document.querySelector<HTMLInputElement>('#remote-template-id');
  const accessPrincipalsInput = document.querySelector<HTMLTextAreaElement>('#access-principals');
  const accessMaxUsesInput = document.querySelector<HTMLInputElement>('#access-max-uses');
  const userDirectorySearchInput = document.querySelector<HTMLInputElement>('#user-directory-search');

  templateInput?.addEventListener('change', async () => {
    const file = templateInput.files?.[0];
    if (!file) return;
    const parsed = await readJsonFile(file);
    applyTemplate(parsed as Template);
    templateInput.value = '';
  });

  basePdfInput?.addEventListener('change', async () => {
    const file = basePdfInput.files?.[0];
    if (!file || (state.route !== 'admin' && state.route !== 'access')) return;
    const dataUrl = await readFileAsDataUrl(file);
    const nextTemplate = cloneDeep(state.template);
    nextTemplate.basePdf = dataUrl;
    applyTemplate(nextTemplate);
    basePdfInput.value = '';
  });

  inputsInput?.addEventListener('change', async () => {
    const file = inputsInput.files?.[0];
    if (!file || state.route !== 'user') return;
    const parsed = await readJsonFile(file);
    applyInputs(parsed);
    inputsInput.value = '';
  });

  authTokenInput?.addEventListener('input', () => {
    state.authToken = authTokenInput.value.trim();
    persistAuthToken(state.authToken);
  });

  templateNameInput?.addEventListener('input', () => {
    state.templateName = templateNameInput.value.trim();
    persistTemplateName(state.templateName);
  });

  remoteTemplateInput?.addEventListener('input', () => {
    state.remoteTemplateId = remoteTemplateInput.value.trim();
    persistRemoteTemplateId(state.remoteTemplateId);
  });

  accessPrincipalsInput?.addEventListener('input', () => {
    state.selectedAccessPrincipals = parsePrincipals(accessPrincipalsInput.value);
    syncRemotePanels();
  });

  accessMaxUsesInput?.addEventListener('input', () => {
    const parsed = Number(accessMaxUsesInput.value);
    state.adminAccessMaxUses = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  });

  userDirectorySearchInput?.addEventListener('input', () => {
    state.userDirectoryQuery = userDirectorySearchInput.value.trim();
    syncRemotePanels();
  });

  const templateText = document.querySelector<HTMLTextAreaElement>('#template-json');
  const inputsText = document.querySelector<HTMLTextAreaElement>('#inputs-json');

  templateText?.addEventListener('input', () => {
    state.templateDraft = templateText.value;
  });

  inputsText?.addEventListener('input', () => {
    state.inputsDraft = inputsText.value;
  });
}

function navigateTo(route: RouteName) {
  if (route === state.route) return;
  state.route = route;
  history.pushState({}, '', routePath(route));
  ensureRoute();
  syncAuthState();
  renderShell();
  void mountUi();
  syncEditors();
  refreshSummary();
  refreshTodoPanel();
  refreshNotices();
  void refreshRouteData();
}

function syncAuthState() {
  if (!authView.isAuthenticated) {
    if (state.route !== 'login') {
      state.route = 'login';
      history.replaceState({}, '', routePath('login'));
    }
    return;
  }

  if (state.route === 'login') {
    state.route = authView.isAdmin ? 'admin' : 'user';
    history.replaceState({}, '', routePath(state.route));
  }

  if (state.route === 'admin' && !authView.isAdmin) {
    state.route = 'user';
    history.replaceState({}, '', routePath(state.route));
  }

  if (state.route === 'access' && !authView.isAdmin) {
    state.route = 'user';
    history.replaceState({}, '', routePath(state.route));
  }

}

function ensureRoute() {
  const desiredRoute = routePath(state.route);
  if (location.pathname !== desiredRoute) {
    history.replaceState({}, '', desiredRoute);
  }
}

async function mountUi() {
  const requestId = ++mountRequestId;
  const mount = document.querySelector<HTMLDivElement>('#pdfme-mount');
  if (!mount) return;

  if (state.route === 'login') {
    if (activeUi) {
      activeUi.destroy();
      activeUi = null;
      activeUiKind = null;
    }
    return;
  }

  if (activeUi) {
    activeUi.destroy();
    activeUi = null;
    activeUiKind = null;
  }

  setStatus('Chargement de l interface PDF...');

  const { Designer, Form } = await loadUiModule();
  if (requestId !== mountRequestId) return;

  const commonOptions = {
    lang: state.lang,
    ...(state.route === 'admin' || state.route === 'access' ? DESIGNER_OPTIONS : FORM_OPTIONS),
  };

  if (state.route === 'admin' || state.route === 'access') {
    const designer = new Designer({
      domContainer: mount,
      template: state.template,
      options: commonOptions,
      plugins: uiPlugins,
    }) as unknown as DesignerLike;

    designer.onSaveTemplate((template) => {
      state.template = cloneDeep(template);
      state.templateDraft = JSON.stringify(state.template, null, 2);
      persistTemplate(state.template);
      refreshSummary();
      syncTemplateEditor();
      pushNotice('Template sauvegarde depuis le designer.', 'success');
    });

    designer.onChangeTemplate((template) => {
      state.template = cloneDeep(template);
      state.templateDraft = JSON.stringify(state.template, null, 2);
      persistTemplate(state.template);
      syncTemplateEditor();
      refreshSummary();
    });

    designer.onPageChange(({ currentPage, totalPages }) => {
      setStatus(`Designer: page ${currentPage}/${totalPages}`);
    });

    activeUi = designer;
    activeUiKind = 'admin';
    return;
  }

  const form = new Form({
    domContainer: mount,
    template: state.template,
    inputs: ensureInputs(state.template, state.inputs),
    options: commonOptions,
    plugins: uiPlugins,
  }) as unknown as FormLike;

  form.onChangeInput(({ index, name, value }) => {
    if (!state.inputs[index]) state.inputs[index] = {};
    state.inputs[index][name] = value;
    state.inputsDraft = JSON.stringify(state.inputs, null, 2);
    persistInputs(state.inputs);
    syncInputsEditor();
  });

  form.onPageChange(({ currentPage, totalPages }) => {
    setStatus(`Formulaire: page ${currentPage}/${totalPages}`);
  });

  activeUi = form;
  activeUiKind = 'user';
}

function getDesignerUi() {
  if ((state.route !== 'admin' && state.route !== 'access') || activeUiKind !== 'admin' || !activeUi) return null;
  return activeUi as DesignerLike;
}

function getFormUi() {
  if (state.route !== 'user' || activeUiKind !== 'user' || !activeUi) return null;
  return activeUi as FormLike;
}

async function handleAction(action: string, button?: HTMLButtonElement) {
  if (action === 'auth-signin') {
    await signInWithCognito();
    return;
  }

  if (action === 'goto-admin') {
    navigateTo('admin');
    return;
  }

  if (action === 'goto-user') {
    navigateTo('user');
    return;
  }

  if (action === 'auth-refresh') {
    await refreshAuthSession();
    return;
  }

  if (action === 'auth-signout') {
    await signOutFromCognito();
    return;
  }

  if (action === 'save-local') {
    saveWorkspaceFiles();
    pushNotice('Fichiers exportes et etat sauvegarde localement.', 'success');
    return;
  }

  if (action === 'refresh-remote') {
    await refreshRemoteTemplates();
    return;
  }

  if (action === 'refresh-inbox') {
    await refreshRemoteInbox();
    return;
  }

  if (action === 'refresh-user-directory') {
    await refreshUserDirectory();
    return;
  }

  if (action === 'toggle-user-principal') {
    const principal = (button?.dataset.principal || '').trim();
    if (principal) {
      toggleAccessPrincipal(principal);
    }
    return;
  }

  if (action === 'publish-template') {
    await publishCurrentTemplate();
    return;
  }

  if (action === 'load-remote-template') {
    await loadPublishedTemplate();
    return;
  }

  if (action === 'open-inbox-template') {
    const templateId = button?.dataset.templateId || '';
    if (templateId) {
      await openInboxDocument(templateId);
    }
    return;
  }

  if (action === 'load-selected-document') {
    if (state.selectedInboxTemplateId) {
      await openInboxDocument(state.selectedInboxTemplateId, true);
    }
    return;
  }

  if (action === 'close-document-modal') {
    closeDocumentModal();
    return;
  }

  if (action === 'apply-json') {
    applyJsonFromEditors();
    return;
  }

  if (action === 'template-json' || action === 'download-template') {
    downloadJson(state.template, 'template-pdfme.json');
    pushNotice('Template JSON telecharge.', 'info');
    return;
  }

  if (action === 'download-inputs') {
    downloadJson(state.inputs, 'inputs-pdfme.json');
    pushNotice('Inputs JSON telecharges.', 'info');
    return;
  }

  if (action === 'reset-template') {
    applyTemplate(cloneDeep(sampleTemplates.contract));
    pushNotice('Template reinitialise.', 'warning');
    return;
  }

  if (action === 'load-contract') {
    applyTemplate(cloneDeep(sampleTemplates.contract));
    pushNotice('Modele Contrat charge.', 'info');
    return;
  }

  if (action === 'load-invoice') {
    applyTemplate(cloneDeep(sampleTemplates.invoice));
    pushNotice('Modele Facture charge.', 'info');
    return;
  }

  if (action === 'load-onboarding') {
    applyTemplate(cloneDeep(sampleTemplates.onboarding));
    pushNotice('Modele Onboarding charge.', 'info');
    return;
  }

  if (action === 'add-page') {
    appendPage();
    return;
  }

  if (action === 'interactive-pdf') {
    await exportPdf(true);
    markTodo(3, true);
    return;
  }

  if (action === 'final-pdf') {
    await exportPdf(false);
    markTodo(4, true);
    return;
  }

  if (action === 'preview-pdf') {
    await previewPdf();
    return;
  }

  if (action === 'fill-example') {
    fillWithExampleData();
    return;
  }

  if (action === 'clear-inputs') {
    clearInputs();
  }
}

async function signInWithCognito() {
  authView.isLoading = true;
  renderShell();
  await startSigninRedirect();
}

async function signOutFromCognito() {
  await clearOidcSession();
  authView.isAuthenticated = false;
  authView.isAdmin = false;
  authView.email = '';
  authView.expiresAt = null;
  authView.isLoading = false;
  state.authToken = '';
  persistAuthToken('');
  state.remoteAccess = null;
  state.remoteInbox = [];
  state.selectedInboxTemplateId = '';
  state.route = 'login';
  history.replaceState({}, '', routePath('login'));
  renderShell();
  startCognitoLogoutRedirect();
}

async function refreshAuthSession() {
  authView.isLoading = true;
  renderShell();

  try {
    const user = await getStoredAuthSession();
    const snapshot = toAuthSnapshot(user);
    authView.isAuthenticated = snapshot.isAuthenticated;
    authView.isAdmin = snapshot.isAdmin;
    authView.email = snapshot.email;
    authView.expiresAt = snapshot.expiresAt;
    authView.isLoading = false;

    state.authToken = snapshot.accessToken || '';
    persistAuthToken(state.authToken);

    if (!snapshot.isAuthenticated) {
      pushNotice('Session expirée. Reconnecte-toi pour continuer.', 'warning');
    } else {
      pushNotice('Session Cognito rafraichie depuis le stockage local.', 'info');
    }
    syncAuthState();
  } catch (error) {
    authView.isLoading = false;
    pushNotice(`Impossible de rafraichir la session: ${(error as Error).message}`, 'danger');
  }

  renderShell();
  syncEditors();
  refreshSummary();
  refreshTodoPanel();
  refreshNotices();
  void mountUi();
  void refreshRouteData();
}

async function refreshRouteData() {
  if (!authView.isAuthenticated) return;

  if (state.route === 'admin') {
    await refreshRemoteTemplates(true);
  }

  if (state.route === 'access') {
    await refreshRemoteTemplates(true);
    await refreshUserDirectory(true);
    if (state.remoteTemplateId) {
      await refreshRemoteAccessStatus(true);
    }
  }

  if (state.route === 'user') {
    await refreshRemoteInbox(true);
    if (state.remoteTemplateId) {
      await loadPublishedTemplate(true);
    }
  }
}

async function openInboxDocument(templateId: string, keepModalOpen = false, silent = false) {
  state.selectedInboxTemplateId = templateId;
  state.remoteTemplateId = templateId;
  persistRemoteTemplateId(templateId);
  syncAdminFields();

  try {
    const access = await checkRemoteAccess(templateId, state.authToken || undefined);
    state.remoteAccess = access;

    if (!access.allowed) {
      syncRemotePanels();
      if (!silent) {
        pushNotice(`Acces refuse: ${access.reason}`, 'danger');
      }
      return;
    }

    const { template } = await loadRemoteTemplate(templateId, state.authToken || undefined);
    applyTemplate(template.template, true);
    state.templateName = template.name;
    persistTemplateName(state.templateName);
    syncAdminFields();
    syncRemotePanels();
    if (!keepModalOpen) {
      closeDocumentModal();
    }
    if (!silent) {
      pushNotice(`Document charge: ${template.name}`, 'success');
    }
  } catch (error) {
    if (!silent) {
      pushNotice(`Chargement du document impossible: ${(error as Error).message}`, 'danger');
    }
  }
}

function closeDocumentModal() {
  state.selectedInboxTemplateId = '';
  syncRemotePanels();
}

function appendField(kind: FieldKind) {
  const designer = getDesignerUi();
  if (!designer) return;
  state.template = appendFieldFromDesigner(designer, kind);
  state.templateDraft = JSON.stringify(state.template, null, 2);
  persistTemplate(state.template);
  syncTemplateEditor();
  refreshSummary();
  pushNotice(`Champ ${kind} ajoute.`, 'success');
}

function appendPage() {
  const designer = getDesignerUi();
  if (!designer) return;
  const template = cloneDeep(designer.getTemplate());
  template.schemas.push([]);
  designer.updateTemplate(template);
  state.template = template;
  state.templateDraft = JSON.stringify(state.template, null, 2);
  persistTemplate(state.template);
  syncTemplateEditor();
  refreshSummary();
  pushNotice('Page vide ajoutee.', 'success');
}

function applyTemplate(value: Template, preserveRemoteLink = false) {
  checkTemplate(value);
  state.template = cloneDeep(value);
  state.inputs = getInputFromTemplate(state.template);
  state.templateDraft = JSON.stringify(state.template, null, 2);
  state.inputsDraft = JSON.stringify(state.inputs, null, 2);

  if (!preserveRemoteLink) {
    state.remoteTemplateId = '';
    state.remoteAccess = null;
    state.selectedInboxTemplateId = '';
    persistRemoteTemplateId('');
  }

  persistAll();
  syncEditors();
  refreshSummary();
  void mountUi();
  pushNotice('Template applique.', 'success');
}

function applyInputs(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error('Inputs JSON invalide');
  }
  state.inputs = value as Record<string, string>[];
  state.inputsDraft = JSON.stringify(state.inputs, null, 2);
  persistInputs(state.inputs);
  syncInputsEditor();
  void mountUi();
  pushNotice('Inputs appliques.', 'success');
}

function applyJsonFromEditors() {
  try {
    if (state.route === 'admin' || state.route === 'access') {
      const parsedTemplate = JSON.parse(state.templateDraft) as Template;
      applyTemplate(parsedTemplate);
      return;
    }

    const parsedInputs = JSON.parse(state.inputsDraft) as Record<string, string>[];
    applyInputs(parsedInputs);
  } catch (error) {
    pushNotice(`JSON invalide: ${(error as Error).message}`, 'danger');
  }
}

function fillWithExampleData() {
  const template = currentTemplate();
  state.inputs = fillTemplateDefaults(template, getInputFromTemplate(template));

  state.inputs = state.inputs.map((row) => {
    const output = { ...row };
    Object.keys(output).forEach((key) => {
      const lower = key.toLowerCase();
      if (lower.includes('name')) output[key] = 'Matheo Dupont';
      else if (lower.includes('email')) output[key] = 'matheo@example.com';
      else if (lower.includes('date')) output[key] = new Date().toISOString().slice(0, 10);
      else if (lower.includes('time')) output[key] = '14:30';
      else if (lower.includes('qrcode')) output[key] = 'https://pdfme.com/';
      else if (lower.includes('signature')) output[key] = '';
      else output[key] = 'Exemple';
    });
    return output;
  });

  state.inputsDraft = JSON.stringify(state.inputs, null, 2);
  persistInputs(state.inputs);
  syncInputsEditor();
  void mountUi();
  pushNotice('Donnees d exemple injectees.', 'success');
}

function clearInputs() {
  state.inputs = fillTemplateDefaults(currentTemplate(), getInputFromTemplate(currentTemplate()));
  state.inputsDraft = JSON.stringify(state.inputs, null, 2);
  persistInputs(state.inputs);
  syncInputsEditor();
  void mountUi();
  pushNotice('Inputs reinitialises.', 'warning');
}

async function refreshRemoteTemplates(silent = false) {
  try {
    const { templates } = await loadRemoteTemplates(state.authToken || undefined);
    state.remoteTemplates = templates;
    syncRemotePanels();
    if (!silent) {
      pushNotice(`${templates.length} template(s) distant(s) charge(s).`, 'info');
    }
  } catch (error) {
    pushNotice(`Impossible de charger les templates distants: ${(error as Error).message}`, 'danger');
  }
}

async function refreshRemoteInbox(silent = false) {
  try {
    const { documents } = await loadRemoteInbox(state.authToken || undefined);
    state.remoteInbox = documents;

    if (state.remoteInbox.length > 0 && !state.selectedInboxTemplateId) {
      state.selectedInboxTemplateId = state.remoteInbox[0].template.id;
    }

    syncRemotePanels();
    if (!silent) {
      pushNotice(`${documents.length} document(s) à signer chargé(s).`, 'info');
    }
  } catch (error) {
    pushNotice(`Impossible de charger l'inbox: ${(error as Error).message}`, 'danger');
  }
}

async function refreshUserDirectory(silent = false) {
  if (!state.authToken) {
    state.remoteUsers = [];
    syncRemotePanels();
    return;
  }

  try {
    const { users } = await loadRemoteUserDirectory(state.authToken, state.remoteTemplateId || undefined);
    state.remoteUsers = users;
    syncRemotePanels();
    if (!silent) {
      pushNotice(`${users.length} user(s) disponible(s) pour attribution.`, 'info');
    }
  } catch (error) {
    if (!silent) {
      pushNotice(`Impossible de charger la liste users: ${(error as Error).message}`, 'danger');
    }
  }
}

async function publishCurrentTemplate() {
  if (!state.authToken) {
    pushNotice('Ajoute un jeton Cognito admin avant de publier.', 'warning');
    return;
  }

  try {
    const templateName = getTemplateNameValue() || state.templateName || `Template ${new Date().toISOString().slice(0, 10)}`;
    const result = await saveRemoteTemplate(
      {
        id: state.remoteTemplateId || undefined,
        name: templateName,
        template: currentTemplate(),
        status: 'published',
      },
      state.authToken,
    );

    state.remoteTemplateId = result.template.id;
    state.templateName = templateName;
    persistRemoteTemplateId(state.remoteTemplateId);
    persistTemplateName(state.templateName);
    syncAdminFields();

    const principals = getAccessPrincipals();
    if (principals.length > 0) {
      await Promise.allSettled(
        principals.map((principal) => {
          const user = state.remoteUsers.find((entry) => entry.principal === principal);
          return grantRemoteAccess(
            {
              templateId: result.template.id,
              principal,
              label: user?.label || principal,
              maxUses: state.adminAccessMaxUses,
            },
            state.authToken,
          );
        }),
      );
    }

    await refreshRemoteTemplates();
    await refreshRemoteInbox();
    await refreshUserDirectory(true);
    await refreshRemoteAccessStatus(true);
    pushNotice(`Template publie: ${result.template.id}`, 'success');
  } catch (error) {
    pushNotice(`Publication impossible: ${(error as Error).message}`, 'danger');
  }
}

async function loadPublishedTemplate(silent = false) {
  const templateId = getRemoteTemplateIdValue();
  if (!templateId) {
    if (!silent) {
      pushNotice('Renseigne un ID de template publie.', 'warning');
    }
    return;
  }

  if (!state.authToken) {
    if (!silent) {
      pushNotice('Ajoute un jeton Cognito avant de charger un template publie.', 'warning');
    }
    return;
  }

  await openInboxDocument(templateId, false, silent);
}

function getTemplateNameValue() {
  return document.querySelector<HTMLInputElement>('#template-name')?.value.trim() || '';
}

function getRemoteTemplateIdValue() {
  return document.querySelector<HTMLInputElement>('#remote-template-id')?.value.trim() || state.remoteTemplateId;
}

function getAccessPrincipals() {
  const raw = document.querySelector<HTMLTextAreaElement>('#access-principals')?.value || '';
  return parsePrincipals(raw);
}

function parsePrincipals(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[\n,;]/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function toggleAccessPrincipal(principal: string) {
  const exists = state.selectedAccessPrincipals.includes(principal);
  state.selectedAccessPrincipals = exists
    ? state.selectedAccessPrincipals.filter((value) => value !== principal)
    : state.selectedAccessPrincipals.concat(principal);

  const accessPrincipalsInput = document.querySelector<HTMLTextAreaElement>('#access-principals');
  if (accessPrincipalsInput) {
    accessPrincipalsInput.value = state.selectedAccessPrincipals.join('\n');
  }
  syncRemotePanels();
}

function syncAdminFields() {
  const authTokenInput = document.querySelector<HTMLInputElement>('#auth-token');
  const templateNameInput = document.querySelector<HTMLInputElement>('#template-name');
  const remoteTemplateInput = document.querySelector<HTMLInputElement>('#remote-template-id');
  const accessMaxUsesInput = document.querySelector<HTMLInputElement>('#access-max-uses');
  const accessPrincipalsInput = document.querySelector<HTMLTextAreaElement>('#access-principals');
  const userDirectorySearchInput = document.querySelector<HTMLInputElement>('#user-directory-search');

  if (authTokenInput && authTokenInput.value !== state.authToken) {
    authTokenInput.value = state.authToken;
  }

  if (templateNameInput && templateNameInput.value !== state.templateName) {
    templateNameInput.value = state.templateName;
  }

  if (remoteTemplateInput && remoteTemplateInput.value !== state.remoteTemplateId) {
    remoteTemplateInput.value = state.remoteTemplateId;
  }

  if (accessMaxUsesInput && Number(accessMaxUsesInput.value) !== state.adminAccessMaxUses) {
    accessMaxUsesInput.value = String(state.adminAccessMaxUses);
  }

  if (accessPrincipalsInput) {
    const parsed = parsePrincipals(accessPrincipalsInput.value);
    if (parsed.join('\n') !== state.selectedAccessPrincipals.join('\n')) {
      state.selectedAccessPrincipals = parsed;
    }
  }

  if (userDirectorySearchInput && userDirectorySearchInput.value !== state.userDirectoryQuery) {
    userDirectorySearchInput.value = state.userDirectoryQuery;
  }
}

function syncRemotePanels() {
  const remoteTemplateList = document.querySelector<HTMLDivElement>('#remote-template-list');
  if (remoteTemplateList) {
    remoteTemplateList.innerHTML = state.remoteTemplates.length
      ? state.remoteTemplates
          .map(
            (template) => `
              <div class="summary-row">
                <strong>${escapeHtml(template.name)}</strong>
                <span>${escapeHtml(template.id)}</span>
              </div>
            `,
          )
          .join('')
      : '<p class="notice-empty">Aucun template publie pour le moment.</p>';
  }

  const remoteInboxList = document.querySelector<HTMLDivElement>('#remote-inbox-list');
  if (remoteInboxList) {
    remoteInboxList.innerHTML = state.remoteInbox.length
      ? state.remoteInbox
          .map(
            (entry) => `
              <button class="summary-row inbox-row ${entry.template.id === state.selectedInboxTemplateId ? 'active' : ''}" data-action="open-inbox-template" data-template-id="${escapeHtml(entry.template.id)}">
                <strong>${escapeHtml(entry.template.name)}</strong>
                <span>${escapeHtml(entry.access.principal)} · ${entry.access.usedCount}/${entry.access.maxUses}</span>
              </button>
            `,
          )
          .join('')
      : '<p class="notice-empty">Aucun document attribué pour le moment.</p>';
  }

  const userDirectoryList = document.querySelector<HTMLDivElement>('#user-directory-list');
  if (userDirectoryList) {
    const filterValue = state.userDirectoryQuery.trim().toLowerCase();
    const filteredUsers = !filterValue
      ? state.remoteUsers
      : state.remoteUsers.filter((user) => {
          const haystack = [user.label, user.principal, user.email || '', user.username || '', user.sub || ''].join(' ').toLowerCase();
          return haystack.includes(filterValue);
        });

    userDirectoryList.innerHTML = filteredUsers.length
      ? filteredUsers
          .map((user) => {
            const selected = state.selectedAccessPrincipals.includes(user.principal);
            const label = user.label || user.principal;
            const granted = user.grantedCount > 0 ? `${user.grantedCount} attribution(s)` : 'Aucune attribution';
            const cognitoStatus = user.userStatus ? user.userStatus.toLowerCase() : 'unknown';
            const enabledStatus = user.enabled ? 'enabled' : 'disabled';
            const identity = user.email || user.username || user.sub || user.principal;
            return `
              <button class="summary-row inbox-row ${selected ? 'active' : ''}" data-action="toggle-user-principal" data-principal="${escapeHtml(user.principal)}">
                <strong>${escapeHtml(label)}</strong>
                <span>${escapeHtml(identity)} · ${escapeHtml(enabledStatus)} · ${escapeHtml(cognitoStatus)} · ${escapeHtml(granted)}${user.hasTemplateAccess ? ' · déjà autorisé' : ''}</span>
              </button>
            `;
          })
          .join('')
      : '<p class="notice-empty">Aucun user ne correspond à la recherche (ou pool Cognito inaccessible).</p>';

    userDirectoryList.querySelectorAll<HTMLButtonElement>('[data-action="toggle-user-principal"]').forEach((button) => {
      button.addEventListener('click', async () => {
        await handleAction('toggle-user-principal', button);
      });
    });
  }

  remoteInboxList?.querySelectorAll<HTMLButtonElement>('[data-action="open-inbox-template"]').forEach((button) => {
    button.addEventListener('click', async () => {
      await handleAction('open-inbox-template', button);
    });
  });

  const accessStatus = document.querySelector<HTMLDivElement>('#access-status');
  if (accessStatus) {
    if (!state.remoteAccess) {
      accessStatus.innerHTML = '<p class="notice-empty">Charge un template pour verifier l’accès Cognito.</p>';
    } else {
      const access = state.remoteAccess.access;
      accessStatus.innerHTML = `
        <div class="summary-row"><strong>Autorise</strong><span>${state.remoteAccess.allowed ? 'oui' : 'non'}</span></div>
        <div class="summary-row"><strong>Motif</strong><span>${escapeHtml(state.remoteAccess.reason)}</span></div>
        <div class="summary-row"><strong>Principal</strong><span>${escapeHtml(state.remoteAccess.principal || '-')}</span></div>
        <div class="summary-row"><strong>Utilisations</strong><span>${access ? `${access.usedCount}/${access.maxUses}` : '-'}</span></div>
      `;
    }
  }

  syncDocumentModal();
}

async function refreshRemoteAccessStatus(silent = false) {
  if (!state.remoteTemplateId) {
    state.remoteAccess = null;
    syncRemotePanels();
    return;
  }

  try {
    const access = await checkRemoteAccess(state.remoteTemplateId, state.authToken || undefined);
    state.remoteAccess = access;
    syncRemotePanels();
    if (!silent) {
      pushNotice(`Etat d’accès rafraichi pour ${state.remoteTemplateId}.`, 'info');
    }
  } catch (error) {
    if (!silent) {
      pushNotice(`Impossible de verifier l'accès: ${(error as Error).message}`, 'danger');
    }
  }
}

function syncDocumentModal() {
  const modal = document.querySelector<HTMLDivElement>('#document-modal');
  const content = document.querySelector<HTMLDivElement>('#document-modal-content');
  if (!modal || !content) return;

  const selected = state.remoteInbox.find((item) => item.template.id === state.selectedInboxTemplateId) || null;
  const isVisible = Boolean(selected);

  modal.classList.toggle('hidden', !isVisible);
  modal.setAttribute('aria-hidden', String(!isVisible));

  if (!selected) {
    content.innerHTML = '<p class="notice-empty">Sélectionne un document dans l’inbox.</p>';
    return;
  }

  content.innerHTML = `
    <div class="summary-row"><strong>Document</strong><span>${escapeHtml(selected.template.name)}</span></div>
    <div class="summary-row"><strong>ID</strong><span>${escapeHtml(selected.template.id)}</span></div>
    <div class="summary-row"><strong>Principal</strong><span>${escapeHtml(selected.access.principal)}</span></div>
    <div class="summary-row"><strong>Utilisations</strong><span>${selected.access.usedCount}/${selected.access.maxUses}</span></div>
    <div class="summary-row"><strong>Accès</strong><span>${selected.allowed ? 'autorisé' : 'bloqué'}</span></div>
  `;
}

async function exportPdf(fillable: boolean) {
  const template = currentTemplate();
  const inputs = currentInputs(template);
  const { generate } = await loadGeneratorModule();

  const pdf = fillable
    ? await generateFillablePdf(template, inputs, uiPlugins as unknown as Record<string, unknown>)
    : await generate({
        template,
        inputs,
        options: { font: getDefaultFont(), title: 'pdfme-studio' },
        plugins: uiPlugins,
      });

  downloadBinary(pdf, fillable ? 'pdf-interactif.pdf' : 'pdf-rempli.pdf');
  pushNotice(fillable ? 'PDF interactif exporte.' : 'PDF final exporte.', 'success');

  if (!fillable && state.remoteTemplateId && state.authToken) {
    try {
      const response = await consumeRemoteAccess(state.remoteTemplateId, state.authToken);
      state.remoteAccess = {
        allowed: false,
        reason: 'consumed',
        principal: response.access.principal,
        access: response.access,
      };
      syncRemotePanels();
      pushNotice('Acces consommé après export du PDF final.', 'info');
    } catch (error) {
      pushNotice(`Impossible de consommer l’accès: ${(error as Error).message}`, 'warning');
    }
  }
}

async function previewPdf() {
  const template = currentTemplate();
  const inputs = currentInputs(template);
  const { generate } = await loadGeneratorModule();
  const pdf = await generate({
    template,
    inputs,
    options: { font: getDefaultFont(), title: 'pdfme-studio-preview' },
    plugins: uiPlugins,
  });

  const blob = new Blob([pdf.buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  pushNotice('Apercu ouvert dans un nouvel onglet.', 'info');
}

function currentTemplate() {
  return activeUi ? cloneDeep(activeUi.getTemplate()) : cloneDeep(state.template);
}

function currentInputs(template: Template) {
  const formUi = getFormUi();
  if (formUi) {
    const inputs = formUi.getInputs();
    return inputs && inputs.length > 0 ? fillTemplateDefaults(template, inputs) : fillTemplateDefaults(template, getInputFromTemplate(template));
  }

  return state.inputs.length > 0 ? fillTemplateDefaults(template, state.inputs) : fillTemplateDefaults(template, getInputFromTemplate(template));
}

function ensureInputs(template: Template, inputs: Record<string, string>[]) {
  return inputs.length > 0 ? fillTemplateDefaults(template, inputs) : fillTemplateDefaults(template, getInputFromTemplate(template));
}

function refreshSummary() {
  const summary = summarizeTemplate(state.template);

  const templateSummary = document.querySelector<HTMLDivElement>('#template-summary');
  if (templateSummary) {
    templateSummary.innerHTML = `
      <div class="summary-item"><strong>${summary.pageCount}</strong><span>pages</span></div>
      <div class="summary-item"><strong>${summary.fieldCount}</strong><span>champs</span></div>
      <div class="summary-item"><strong>${summary.types.join(', ') || '-'}</strong><span>types</span></div>
    `;
  }

  const fieldSummary = document.querySelector<HTMLDivElement>('#field-summary');
  if (fieldSummary) {
    const pages = state.template.schemas.map((page, index) => {
      const pageFields = page.map((schema) => schema.name).slice(0, 5).join(', ');
      return `<div class="summary-row"><strong>Page ${index + 1}</strong><span>${escapeHtml(pageFields || 'Vide')}</span></div>`;
    });
    fieldSummary.innerHTML = pages.join('');
  }
}

function refreshTodoPanel() {
  const todoList = document.querySelector<HTMLDivElement>('#todo-list');
  if (!todoList) return;

  todoList.innerHTML = renderTodoItems(state.todos);
  todoList.querySelectorAll<HTMLButtonElement>('[data-todo-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.todoId);
      state.todos = state.todos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo));
      persistTodos(state.todos);
      refreshTodoPanel();
      pushNotice('Plan IA mis a jour.', 'info');
    });
  });
}

function refreshNotices() {
  const noticeList = document.querySelector<HTMLDivElement>('#notice-list');
  if (!noticeList) return;

  noticeList.innerHTML = state.notices.length
    ? state.notices
        .slice(-6)
        .map((notice) => `<div class="notice-item ${notice.tone}">${escapeHtml(notice.message)}</div>`)
        .join('')
    : '<p class="notice-empty">Pret a travailler.</p>';
}

function pushNotice(message: string, tone: NoticeTone = 'info') {
  state.notices.push({ id: Date.now() + Math.random(), message, tone });
  if (state.notices.length > 10) state.notices = state.notices.slice(-10);
  refreshNotices();
}

function setStatus(message: string) {
  const title = document.querySelector<HTMLElement>('#stage-title');
  if (!title) return;
  title.setAttribute('title', message);
}

function syncEditors() {
  syncTemplateEditor();
  syncInputsEditor();
  syncAdminFields();
  syncRemotePanels();
}

function syncTemplateEditor() {
  const templateText = document.querySelector<HTMLTextAreaElement>('#template-json');
  if (templateText) templateText.value = state.templateDraft;
}

function syncInputsEditor() {
  const inputsText = document.querySelector<HTMLTextAreaElement>('#inputs-json');
  if (inputsText) inputsText.value = state.inputsDraft;
}

function persistAll() {
  persistTemplate(state.template);
  persistInputs(state.inputs);
  persistTodos(state.todos);
  persistLang(state.lang);
  persistAuthToken(state.authToken);
  persistRemoteTemplateId(state.remoteTemplateId);
  persistTemplateName(state.templateName);
}

function saveWorkspaceFiles() {
  persistAll();
  downloadJson(state.template, 'template-pdfme.json');
  downloadJson(state.inputs, 'inputs-pdfme.json');
  downloadJson(
    {
      route: state.route,
      templateName: state.templateName,
      remoteTemplateId: state.remoteTemplateId,
      savedAt: new Date().toISOString(),
    },
    'pdfme-studio-snapshot.json',
  );
}

function markTodo(todoId: number, done: boolean) {
  state.todos = state.todos.map((todo) => (todo.id === todoId ? { ...todo, done } : todo));
  persistTodos(state.todos);
  refreshTodoPanel();
}

void startup();

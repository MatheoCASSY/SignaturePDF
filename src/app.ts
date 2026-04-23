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
  submitSignedPdf,
  loadAdminSubmissions,
  downloadAdminSubmission,
  deleteAdminSubmission,
  deleteRemoteTemplate,
  loadTemplateGrants,
  revokeRemoteAccess,
  type TemplateGrant,
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
import type { AppState, AuthViewState, FieldKind, NoticeTone, RouteName, SubmissionRecord } from './types/app';
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
  submissions: [],
  templateGrants: [],
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

function stripAllFontRefs(template: Template): Template {
  const schemas = template.schemas.map((page) =>
    page.map((schema) => {
      const s = schema as Record<string, unknown>;
      if ('fontName' in s) {
        const { fontName: _f, ...rest } = s;
        return rest as typeof schema;
      }
      return schema;
    })
  );
  return { ...template, font: {}, schemas };
}

async function prefetchFonts(
  font: Record<string, any>
): Promise<{ font: Record<string, any>; failed: Set<string> }> {
  const result: Record<string, any> = {};
  const failed = new Set<string>();
  await Promise.all(
    Object.entries(font).map(async ([name, cfg]) => {
      if (typeof cfg?.data === 'string' && cfg.data.startsWith('http')) {
        try {
          const buf = await fetch(cfg.data).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.arrayBuffer();
          });
          result[name] = { ...cfg, data: buf };
        } catch {
          console.warn(`[pdfme] Police "${name}" : chargement échoué, ignorée.`);
          failed.add(name);
        }
      } else {
        result[name] = cfg;
      }
    })
  );
  return { font: result, failed };
}

async function generatePdf(
  generate: (...args: any[]) => Promise<Uint8Array>,
  args: { template: Template; inputs: Record<string, string>[]; options: Record<string, unknown>; plugins: typeof uiPlugins }
): Promise<Uint8Array> {
  // Pré-charger les polices HTTP et écarter celles qui échouent
  const { font: fetchedFont, failed } = await prefetchFonts(args.template.font ?? {});
  let template: Template = { ...args.template, font: fetchedFont };
  if (failed.size > 0) {
    const schemas = template.schemas.map((page) =>
      page.map((schema) => {
        const s = schema as Record<string, unknown>;
        if (typeof s.fontName === 'string' && failed.has(s.fontName)) {
          const { fontName: _f, ...rest } = s;
          return rest as typeof schema;
        }
        return schema;
      })
    );
    template = { ...template, schemas };
  }

  // Tentative 1 : génération normale
  try {
    return await generate({ ...args, template });
  } catch { /* suite */ }

  // Tentative 2 : subset: false sur toutes les polices
  const fontEntries = Object.entries(template.font ?? {});
  if (fontEntries.length > 0) {
    const noSubsetFont = Object.fromEntries(
      fontEntries.map(([n, cfg]) => [n, { ...(cfg as object), subset: false }])
    );
    try {
      return await generate({ ...args, template: { ...template, font: noSubsetFont } });
    } catch { /* suite */ }
  }

  // Tentative 3 : supprimer toutes les polices custom + injecter la police locale par défaut avec subset:false
  // Cela garantit que pdfme n'essaie pas de charger des fonts depuis le CDN
  const safeFont = Object.fromEntries(
    Object.entries(getDefaultFont()).map(([n, cfg]) => [n, { ...(cfg as object), subset: false }])
  );
  return generate({ ...args, template: { ...stripAllFontRefs(template), font: safeFont } });
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
    if (!file || state.route !== 'admin') return;
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

  // La page access et login n'ont pas de canvas pdfme
  if (state.route === 'login' || state.route === 'access') {
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

  if (state.route === 'admin') {
    const designer = new Designer({
      domContainer: mount,
      template: state.template,
      options: { lang: state.lang, ...DESIGNER_OPTIONS },
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
    options: { lang: state.lang, ...FORM_OPTIONS },
    plugins: uiPlugins,
  }) as unknown as FormLike;

  form.onChangeInput(({ index, name, value }) => {
    if (!state.inputs[index]) state.inputs[index] = {};
    state.inputs[index][name] = value;
    state.inputsDraft = JSON.stringify(state.inputs, null, 2);
    persistInputs(state.inputs);
    syncInputsEditor();
    updateSignatureProgress();
  });

  form.onPageChange(({ currentPage, totalPages }) => {
    setStatus(`Formulaire: page ${currentPage}/${totalPages}`);
  });

  activeUi = form;
  activeUiKind = 'user';
}

function getDesignerUi() {
  if (state.route !== 'admin' || activeUiKind !== 'admin' || !activeUi) return null;
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

  if (action === 'grant-access') {
    await grantAccess();
    return;
  }

  if (action === 'select-access-template') {
    const templateId = button?.dataset.templateId || '';
    if (templateId) await selectAccessTemplate(templateId);
    return;
  }

  if (action === 'load-admin-template') {
    const templateId = button?.dataset.templateId || '';
    const templateName = button?.dataset.templateName || '';
    if (templateId) await loadAdminTemplate(templateId, templateName);
    return;
  }

  if (action === 'revoke-access') {
    const templateId = button?.dataset.templateId || '';
    const principal = button?.dataset.principal || '';
    const label = button?.dataset.label || principal;
    if (templateId && principal && confirm(`Révoquer l'accès de "${label}" ?`)) {
      await revokeAccess(templateId, principal, label);
    }
    return;
  }

  if (action === 'delete-template') {
    const templateId = button?.dataset.templateId || '';
    const name = state.remoteTemplates.find((t) => t.id === templateId)?.name || templateId;
    if (templateId && confirm(`Supprimer le template "${name}" ? Cette action est irréversible.`)) {
      await deleteTemplate(templateId);
    }
    return;
  }

  if (action === 'refresh-grants') {
    await refreshTemplateGrants();
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
    return;
  }

  if (action === 'submit-pdf') {
    await exportAndSubmitPdf();
    return;
  }

  if (action === 'refresh-submissions') {
    await refreshSubmissions();
    return;
  }

  if (action === 'download-submission') {
    const submissionId = button?.dataset.submissionId || '';
    if (submissionId) await downloadSubmission(submissionId);
    return;
  }

  if (action === 'delete-submission') {
    const submissionId = button?.dataset.submissionId || '';
    if (submissionId) await deleteSubmission(submissionId);
    return;
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
    await refreshSubmissions(true);
    if (state.remoteTemplateId) {
      await refreshTemplateGrants(true);
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
      dropFromInbox(templateId);
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
    updateSignatureProgress();
    if (!silent) {
      pushNotice(`Document chargé : ${template.name}`, 'success');
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
    if (state.route === 'admin') {
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
    pushNotice('Connexion requise pour sauvegarder dans S3.', 'warning');
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
    await refreshRemoteTemplates(true);
    pushNotice(`Template sauvegardé dans S3 : ${result.template.id}`, 'success');
  } catch (error) {
    pushNotice(`Sauvegarde impossible : ${(error as Error).message}`, 'danger');
  }
}

async function grantAccess() {
  if (!state.authToken) {
    pushNotice('Connexion requise pour accorder l\'accès.', 'warning');
    return;
  }

  if (!state.remoteTemplateId) {
    pushNotice('Sélectionnez d\'abord un template dans la liste.', 'warning');
    return;
  }

  const principals = state.selectedAccessPrincipals;
  if (!principals.length) {
    pushNotice('Sélectionnez au moins un signataire dans la liste.', 'warning');
    return;
  }

  try {
    const results = await Promise.allSettled(
      principals.map((principal) => {
        const user = state.remoteUsers.find((entry) => entry.principal === principal);
        return grantRemoteAccess(
          {
            templateId: state.remoteTemplateId,
            principal,
            label: user?.label || principal,
            maxUses: state.adminAccessMaxUses,
          },
          state.authToken,
        );
      }),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    state.selectedAccessPrincipals = [];
    syncAdminFields();
    await refreshUserDirectory(true);
    pushNotice(`Accès accordé à ${succeeded} signataire(s)${failed ? `, ${failed} échec(s)` : ''}.`, succeeded > 0 ? 'success' : 'danger');
  } catch (error) {
    pushNotice(`Impossible d'accorder l'accès : ${(error as Error).message}`, 'danger');
  }
}

async function selectAccessTemplate(templateId: string) {
  state.remoteTemplateId = templateId;
  persistRemoteTemplateId(templateId);
  syncAdminFields();
  syncRemotePanels();
  await Promise.all([refreshUserDirectory(true), refreshTemplateGrants(true)]);
}

async function loadAdminTemplate(templateId: string, templateName: string) {
  if (!state.authToken) {
    pushNotice('Connexion requise pour charger un template.', 'warning');
    return;
  }

  try {
    const { template } = await loadRemoteTemplate(templateId, state.authToken);
    state.remoteTemplateId = templateId;
    state.templateName = template.name || templateName;
    persistRemoteTemplateId(templateId);
    persistTemplateName(state.templateName);
    applyTemplate(template.template, true);
    syncAdminFields();
    pushNotice(`Template "${state.templateName}" chargé — modifiez-le puis cliquez sur Sauvegarder dans S3.`, 'success');
  } catch (error) {
    pushNotice(`Impossible de charger le template : ${(error as Error).message}`, 'danger');
  }
}

async function deleteTemplate(templateId: string) {
  if (!state.authToken) return;
  try {
    const name = state.remoteTemplates.find((t) => t.id === templateId)?.name || templateId;
    await deleteRemoteTemplate(templateId, state.authToken);
    state.remoteTemplates = state.remoteTemplates.filter((t) => t.id !== templateId);
    if (state.remoteTemplateId === templateId) {
      state.remoteTemplateId = '';
      state.templateGrants = [];
      persistRemoteTemplateId('');
    }
    syncRemotePanels();
    pushNotice(`Template supprimé : ${name}`, 'info');
  } catch (error) {
    pushNotice(`Suppression impossible : ${(error as Error).message}`, 'danger');
  }
}

function dropFromInbox(templateId: string) {
  state.remoteInbox = state.remoteInbox.filter((d) => d.template.id !== templateId);
  if (state.remoteTemplateId === templateId) {
    state.remoteTemplateId = '';
    persistRemoteTemplateId('');
  }
  syncRemotePanels();
  updateSignatureProgress();
}

async function revokeAccess(templateId: string, principal: string, label: string) {
  if (!state.authToken) return;
  try {
    await revokeRemoteAccess(templateId, principal, state.authToken);
    state.templateGrants = state.templateGrants.filter((g) => g.principal !== principal);
    syncGrantsPanel();
    await refreshUserDirectory(true);
    pushNotice(`Accès révoqué pour "${label}".`, 'info');
  } catch (error) {
    pushNotice(`Révocation impossible : ${(error as Error).message}`, 'danger');
  }
}

async function refreshTemplateGrants(silent = false) {
  if (!state.authToken || !state.remoteTemplateId) {
    state.templateGrants = [];
    syncGrantsPanel();
    return;
  }
  try {
    const { grants } = await loadTemplateGrants(state.remoteTemplateId, state.authToken);
    state.templateGrants = grants;
    syncGrantsPanel();
  } catch (error) {
    if (!silent) pushNotice(`Impossible de charger les signatures : ${(error as Error).message}`, 'danger');
  }
}

function syncGrantsPanel() {
  const panel = document.querySelector<HTMLDivElement>('#grants-list');
  if (!panel) return;

  if (!state.remoteTemplateId) {
    panel.innerHTML = '<p class="notice-empty">Sélectionnez un template pour voir les signatures.</p>';
    return;
  }

  if (!state.templateGrants.length) {
    panel.innerHTML = '<p class="notice-empty">Aucun accès accordé pour ce template.</p>';
    return;
  }

  const selectedTemplate = state.remoteTemplates.find((t) => t.id === state.remoteTemplateId);
  panel.innerHTML = state.templateGrants
    .map((grant) => {
      const user = state.remoteUsers.find((u) => u.principal === grant.principal);
      const displayName = user?.label || user?.email || user?.username || grant.principal;
      const templateName = selectedTemplate?.name || state.templateName || grant.templateId;
      const grantDate = new Date(grant.grantedAt).toLocaleDateString('fr-FR');
      const signedDate = grant.consumedAt ? new Date(grant.consumedAt).toLocaleDateString('fr-FR') : null;
      const status = signedDate
        ? `<span class="status-badge signed">Signé le ${signedDate}</span>`
        : grant.active
          ? `<span class="status-badge pending">En attente</span>`
          : `<span class="status-badge expired">Expiré</span>`;
      const revokeBtn = !grant.consumedAt
        ? `<button class="mini-button danger" data-action="revoke-access" data-template-id="${escapeHtml(grant.templateId)}" data-principal="${escapeHtml(grant.principal)}" data-label="${escapeHtml(displayName)}">Révoquer</button>`
        : '';
      return `
        <div class="summary-row">
          <div>
            <strong>${escapeHtml(templateName)} — ${escapeHtml(displayName)}</strong>
            <span>Attribué le ${grantDate} · ${grant.usedCount}/${grant.maxUses} signature(s)</span>
          </div>
          <div style="display:flex;gap:6px;align-items:center">${status}${revokeBtn}</div>
        </div>
      `;
    })
    .join('');

  panel.querySelectorAll<HTMLButtonElement>('[data-action="revoke-access"]').forEach((btn) => {
    btn.addEventListener('click', () => handleAction('revoke-access', btn));
  });
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
    if (!state.remoteTemplates.length) {
      remoteTemplateList.innerHTML = '<p class="notice-empty">Aucun template publié pour le moment.</p>';
    } else if (state.route === 'access') {
      remoteTemplateList.innerHTML = state.remoteTemplates
        .map(
          (template) => `
            <button class="summary-row inbox-row ${template.id === state.remoteTemplateId ? 'active' : ''}" data-action="select-access-template" data-template-id="${escapeHtml(template.id)}">
              <strong>${escapeHtml(template.name)}</strong>
              <span>${escapeHtml(template.id)}</span>
            </button>
          `,
        )
        .join('');
      remoteTemplateList.querySelectorAll<HTMLButtonElement>('[data-action="select-access-template"]').forEach((button) => {
        button.addEventListener('click', () => handleAction('select-access-template', button));
      });
    } else {
      remoteTemplateList.innerHTML = state.remoteTemplates
        .map(
          (template) => `
            <div class="summary-row">
              <div>
                <strong>${escapeHtml(template.name)}</strong>
                <span>${escapeHtml(template.id)}</span>
              </div>
              <div style="display:flex;gap:6px">
                <button class="mini-button" data-action="load-admin-template" data-template-id="${escapeHtml(template.id)}" data-template-name="${escapeHtml(template.name)}">Charger</button>
                <button class="mini-button danger" data-action="delete-template" data-template-id="${escapeHtml(template.id)}">Supprimer</button>
              </div>
            </div>
          `,
        )
        .join('');
      remoteTemplateList.querySelectorAll<HTMLButtonElement>('[data-action="load-admin-template"]').forEach((button) => {
        button.addEventListener('click', async () => handleAction('load-admin-template', button));
      });
      remoteTemplateList.querySelectorAll<HTMLButtonElement>('[data-action="delete-template"]').forEach((button) => {
        button.addEventListener('click', async () => handleAction('delete-template', button));
      });
    }
  }

  const remoteInboxList = document.querySelector<HTMLDivElement>('#remote-inbox-list');
  if (remoteInboxList) {
    remoteInboxList.innerHTML = state.remoteInbox.length
      ? state.remoteInbox
          .map(
            (entry) => `
              <button class="summary-row inbox-row ${entry.template.id === state.selectedInboxTemplateId ? 'active' : ''}" data-action="open-inbox-template" data-template-id="${escapeHtml(entry.template.id)}">
                <strong>${escapeHtml(entry.template.name)}</strong>
                <span>Attribué le ${new Date(entry.access.grantedAt).toLocaleDateString('fr-FR')} · ${entry.access.usedCount}/${entry.access.maxUses} signature(s)</span>
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
  syncSubmissionPanel();
  syncGrantsPanel();
}

function syncSubmissionPanel() {
  const submissionList = document.querySelector<HTMLDivElement>('#submission-list');
  if (!submissionList) return;

  if (!state.submissions.length) {
    submissionList.innerHTML = '<p class="notice-empty">Aucune soumission reçue pour le moment.</p>';
    return;
  }

  submissionList.innerHTML = state.submissions
    .map((s) => {
      const date = new Date(s.submittedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
      return `
        <div class="summary-row submission-row">
          <div class="submission-info">
            <strong>${escapeHtml(s.templateName)}</strong>
            <span>${escapeHtml(s.principal)} · ${escapeHtml(date)}</span>
          </div>
          <div class="submission-actions">
            <button class="mini-button" data-action="download-submission" data-submission-id="${escapeHtml(s.id)}">Télécharger</button>
            <button class="mini-button danger" data-action="delete-submission" data-submission-id="${escapeHtml(s.id)}">Supprimer</button>
          </div>
        </div>
      `;
    })
    .join('');

  submissionList.querySelectorAll<HTMLButtonElement>('[data-action="download-submission"], [data-action="delete-submission"]').forEach((button) => {
    button.addEventListener('click', async () => {
      await handleAction(button.dataset.action!, button);
    });
  });
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
    : await generatePdf(generate, { template, inputs, options: { title: 'pdfme-studio' }, plugins: uiPlugins });

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

async function exportAndSubmitPdf() {
  if (!state.authToken) {
    pushNotice('Connexion requise pour envoyer le document.', 'warning');
    return;
  }

  if (!state.remoteTemplateId) {
    pushNotice('Ouvre un document depuis ta liste avant d\'envoyer.', 'warning');
    return;
  }

  try {
    const access = await checkRemoteAccess(state.remoteTemplateId, state.authToken);
    if (!access.allowed) {
      dropFromInbox(state.remoteTemplateId);
      return;
    }
  } catch {
    pushNotice('Impossible de vérifier votre accès. Réessayez.', 'danger');
    return;
  }

  let pdf: Uint8Array;
  try {
    const template = currentTemplate();
    const inputs = currentInputs(template);
    const { generate } = await loadGeneratorModule();
    setStatus('Génération du PDF...');
    pdf = await generatePdf(generate, {
      template,
      inputs,
      options: { title: state.templateName || 'document-signe' },
      plugins: uiPlugins,
    });
  } catch (error) {
    pushNotice(`Erreur génération PDF : ${(error as Error).message}`, 'danger');
    return;
  }

  const safeName = (state.templateName || 'document').replace(/[^a-zA-Z0-9À-ɏ\-_ ]/g, '_');
  downloadBinary(pdf, `${safeName}.pdf`);

  try {
    let binary = '';
    pdf.forEach((b) => (binary += String.fromCharCode(b)));
    const base64 = btoa(binary);
    await submitSignedPdf(
      { templateId: state.remoteTemplateId, templateName: state.templateName || safeName, pdf: base64 },
      state.authToken,
    );
    pushNotice('Document envoyé avec succès.', 'success');
  } catch (error) {
    pushNotice(`Envoi échoué : ${(error as Error).message}`, 'danger');
    return;
  }

  try {
    const response = await consumeRemoteAccess(state.remoteTemplateId, state.authToken);
    const stillActive = !response.access.consumedAt && response.access.usedCount < response.access.maxUses;
    if (!stillActive) {
      dropFromInbox(state.remoteTemplateId);
    } else {
      pushNotice(`Il te reste ${response.access.maxUses - response.access.usedCount} signature(s) disponible(s).`, 'info');
    }
  } catch (error) {
    pushNotice(`Avertissement : ${(error as Error).message}`, 'warning');
  }
}

async function refreshSubmissions(silent = false) {
  if (!state.authToken) return;

  try {
    const { submissions } = await loadAdminSubmissions(state.authToken);
    state.submissions = submissions;
    syncSubmissionPanel();
    if (!silent) {
      pushNotice(`${submissions.length} soumission(s) chargée(s).`, 'info');
    }
  } catch (error) {
    if (!silent) {
      pushNotice(`Impossible de charger les soumissions: ${(error as Error).message}`, 'danger');
    }
  }
}

async function downloadSubmission(id: string) {
  if (!state.authToken) return;

  try {
    setStatus('Téléchargement de la soumission...');
    const { pdf, filename } = await downloadAdminSubmission(id, state.authToken);
    const bytes = Uint8Array.from(atob(pdf), (c) => c.charCodeAt(0));
    downloadBinary(bytes, filename);
    pushNotice('Soumission téléchargée.', 'success');
  } catch (error) {
    pushNotice(`Téléchargement échoué: ${(error as Error).message}`, 'danger');
  }
}

async function deleteSubmission(id: string) {
  if (!state.authToken) return;

  try {
    await deleteAdminSubmission(id, state.authToken);
    state.submissions = state.submissions.filter((s) => s.id !== id);
    syncSubmissionPanel();
    pushNotice('Soumission supprimée.', 'info');
  } catch (error) {
    pushNotice(`Suppression échouée: ${(error as Error).message}`, 'danger');
  }
}

async function previewPdf() {
  const template = currentTemplate();
  const inputs = currentInputs(template);
  const { generate } = await loadGeneratorModule();
  const pdf = await generatePdf(generate, {
    template,
    inputs,
    options: { title: 'pdfme-studio-preview' },
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

function updateSignatureProgress() {
  if (state.route !== 'user') return;

  const decorative = new Set(['line', 'rectangle', 'ellipse', 'svg']);
  const allFields = state.template.schemas
    .flatMap((page) => page)
    .filter((f) => !decorative.has((f as Record<string, unknown>).type as string));
  const total = allFields.length;

  const filled = allFields.filter((f) => {
    const val = state.inputs
      .flatMap((page) => Object.entries(page))
      .find(([k]) => k === f.name)?.[1];
    return val !== undefined && String(val).trim().length > 0;
  }).length;

  const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
  const hasDoc = Boolean(state.remoteTemplateId);
  const allFilled = total > 0 && filled >= total;

  const docCard = document.querySelector<HTMLElement>('#active-doc-card');
  const docName = document.querySelector<HTMLElement>('#active-doc-name');
  const docMeta = document.querySelector<HTMLElement>('#active-doc-meta');
  if (docCard) docCard.classList.toggle('hidden', !hasDoc);
  if (docName) docName.textContent = state.templateName || 'Document';
  if (docMeta) docMeta.textContent = total > 0 ? `${total} champ(s) à remplir` : 'Prêt à signer';

  const progressSection = document.querySelector<HTMLElement>('#fill-progress-section');
  const bar = document.querySelector<HTMLElement>('#fill-progress-bar');
  const label = document.querySelector<HTMLElement>('#fill-progress-label');
  if (progressSection) progressSection.classList.toggle('hidden', !hasDoc || total === 0);
  if (bar) bar.style.width = `${percent}%`;
  if (bar) bar.style.background = allFilled ? 'linear-gradient(90deg,#22c55e,#16a34a)' : '';
  if (label) label.textContent = total > 0 ? `${filled} / ${total} champs` : '';

  document.querySelector('#sig-step-1')?.classList.toggle('done', hasDoc);
  document.querySelector('#sig-step-2')?.classList.toggle('done', allFilled);
  document.querySelector('#sig-step-3')?.classList.toggle('ready', hasDoc);

  const sendBtn = document.querySelector<HTMLButtonElement>('#submit-btn');
  if (sendBtn) {
    sendBtn.disabled = !hasDoc;
    sendBtn.classList.toggle('pulse', allFilled && hasDoc);
  }
}

function syncEditors() {
  syncTemplateEditor();
  syncInputsEditor();
  syncAdminFields();
  syncRemotePanels();
  updateSignatureProgress();
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

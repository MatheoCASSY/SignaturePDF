import { checkTemplate, cloneDeep, getDefaultFont, getInputFromTemplate, type Template } from '@pdfme/common';
import { generate } from '@pdfme/generator';
import { Designer, Form } from '@pdfme/ui';
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
} from './core/storage';
import { summarizeTemplate } from './core/template';
import { renderAppShell } from './components/layout';
import { getTodoProgress, renderTodoItems } from './components/todo';
import { downloadBinary, downloadJson, readFileAsDataUrl, readJsonFile } from './utils/files';
import { parseRoute, routePath } from './utils/routing';
import { escapeHtml } from './utils/dom';
import type { AppState, FieldKind, NoticeTone, RouteName } from './types/app';
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
};

state.inputs = loadInputs(state.template);
state.templateDraft = JSON.stringify(state.template, null, 2);
state.inputsDraft = JSON.stringify(state.inputs, null, 2);

let activeUi: Designer | Form | null = null;

function startup() {
  ensureRoute();
  renderShell();
  mountUi();
  syncEditors();
  refreshSummary();
  refreshTodoPanel();
  refreshNotices();
  window.addEventListener('popstate', onLocationChange);
}

function ensureRoute() {
  if (location.pathname !== routePath(state.route)) {
    history.replaceState({}, '', routePath(state.route));
  }
}

function onLocationChange() {
  const nextRoute = parseRoute(location.pathname);
  if (nextRoute !== state.route) {
    state.route = nextRoute;
    renderShell();
    mountUi();
    syncEditors();
    refreshSummary();
    refreshTodoPanel();
    refreshNotices();
  }
}

function renderShell() {
  const summary = summarizeTemplate(state.template);
  app.innerHTML = renderAppShell({
    route: state.route,
    pageCount: summary.pageCount,
    fieldCount: summary.fieldCount,
    progress: getTodoProgress(state.todos),
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
      await handleAction(action);
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

  templateInput?.addEventListener('change', async () => {
    const file = templateInput.files?.[0];
    if (!file) return;
    const parsed = await readJsonFile(file);
    applyTemplate(parsed as Template);
    templateInput.value = '';
  });

  basePdfInput?.addEventListener('change', async () => {
    const file = basePdfInput.files?.[0];
    if (!file || state.route !== 'design') return;
    const dataUrl = await readFileAsDataUrl(file);
    const nextTemplate = cloneDeep(state.template);
    nextTemplate.basePdf = dataUrl;
    applyTemplate(nextTemplate);
    basePdfInput.value = '';
  });

  inputsInput?.addEventListener('change', async () => {
    const file = inputsInput.files?.[0];
    if (!file || state.route !== 'remplir') return;
    const parsed = await readJsonFile(file);
    applyInputs(parsed);
    inputsInput.value = '';
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
  renderShell();
  mountUi();
  syncEditors();
  refreshSummary();
  refreshTodoPanel();
  refreshNotices();
}

function mountUi() {
  const mount = document.querySelector<HTMLDivElement>('#pdfme-mount');
  if (!mount) return;

  if (activeUi) {
    activeUi.destroy();
    activeUi = null;
  }

  const commonOptions = {
    lang: state.lang,
    ...(state.route === 'design' ? DESIGNER_OPTIONS : FORM_OPTIONS),
  };

  if (state.route === 'design') {
    const designer = new Designer({
      domContainer: mount,
      template: state.template,
      options: commonOptions,
      plugins: uiPlugins,
    });

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
    return;
  }

  const form = new Form({
    domContainer: mount,
    template: state.template,
    inputs: ensureInputs(state.template, state.inputs),
    options: commonOptions,
    plugins: uiPlugins,
  });

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
}

async function handleAction(action: string) {
  if (action === 'save-local') {
    persistAll();
    pushNotice('Etat sauvegarde localement.', 'success');
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

function appendField(kind: FieldKind) {
  if (state.route !== 'design' || !(activeUi instanceof Designer)) return;
  state.template = appendFieldFromDesigner(activeUi, kind);
  state.templateDraft = JSON.stringify(state.template, null, 2);
  persistTemplate(state.template);
  syncTemplateEditor();
  refreshSummary();
  pushNotice(`Champ ${kind} ajoute.`, 'success');
}

function appendPage() {
  if (state.route !== 'design' || !(activeUi instanceof Designer)) return;
  const template = cloneDeep(activeUi.getTemplate());
  template.schemas.push([]);
  activeUi.updateTemplate(template);
  state.template = template;
  state.templateDraft = JSON.stringify(state.template, null, 2);
  persistTemplate(state.template);
  syncTemplateEditor();
  refreshSummary();
  pushNotice('Page vide ajoutee.', 'success');
}

function applyTemplate(value: Template) {
  checkTemplate(value);
  state.template = cloneDeep(value);
  state.inputs = getInputFromTemplate(state.template);
  state.templateDraft = JSON.stringify(state.template, null, 2);
  state.inputsDraft = JSON.stringify(state.inputs, null, 2);
  persistAll();
  syncEditors();
  refreshSummary();
  mountUi();
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
  mountUi();
  pushNotice('Inputs appliques.', 'success');
}

function applyJsonFromEditors() {
  try {
    if (state.route === 'design') {
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
  state.inputs = getInputFromTemplate(template).map((row) => ({ ...row }));

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
  mountUi();
  pushNotice('Donnees d exemple injectees.', 'success');
}

function clearInputs() {
  state.inputs = getInputFromTemplate(currentTemplate());
  state.inputsDraft = JSON.stringify(state.inputs, null, 2);
  persistInputs(state.inputs);
  syncInputsEditor();
  mountUi();
  pushNotice('Inputs reinitialises.', 'warning');
}

async function exportPdf(fillable: boolean) {
  const template = currentTemplate();
  const inputs = currentInputs(template);

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
}

async function previewPdf() {
  const template = currentTemplate();
  const inputs = currentInputs(template);
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
  if (state.route === 'remplir' && activeUi instanceof Form) {
    const inputs = activeUi.getInputs();
    return inputs && inputs.length > 0 ? inputs : getInputFromTemplate(template);
  }

  return state.inputs.length > 0 ? state.inputs : getInputFromTemplate(template);
}

function ensureInputs(template: Template, inputs: Record<string, string>[]) {
  return inputs.length > 0 ? inputs : getInputFromTemplate(template);
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
}

function markTodo(todoId: number, done: boolean) {
  state.todos = state.todos.map((todo) => (todo.id === todoId ? { ...todo, done } : todo));
  persistTodos(state.todos);
  refreshTodoPanel();
}

startup();

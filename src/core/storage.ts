import { checkTemplate, cloneDeep, getInputFromTemplate, type Template } from '@pdfme/common';
import { STORAGE_KEYS } from '../config/storage';
import { sampleTemplates } from '../data/templates';
import { defaultTodos } from '../data/todos';
import { parseRoute } from '../utils/routing';
import type { RouteName, TodoItem } from '../types/app';
import { fillTemplateDefaults } from './template';

export function loadRoute(): RouteName {
  return parseRoute(location.pathname);
}

export function loadLang() {
  return localStorage.getItem(STORAGE_KEYS.lang) || 'fr';
}

export function loadTemplate(): Template {
  const raw = localStorage.getItem(STORAGE_KEYS.template);
  if (!raw) return cloneDeep(sampleTemplates.contract);

  try {
    const parsed = JSON.parse(raw) as Template;
    checkTemplate(parsed);
    return cloneDeep(parsed);
  } catch {
    return cloneDeep(sampleTemplates.contract);
  }
}

export function loadInputs(template: Template): Record<string, string>[] {
  const raw = localStorage.getItem(STORAGE_KEYS.inputs);
  if (!raw) return fillTemplateDefaults(template, getInputFromTemplate(template));

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return fillTemplateDefaults(template, parsed as Record<string, string>[]);
  } catch {
    // Ignore invalid local storage state.
  }

  return fillTemplateDefaults(template, getInputFromTemplate(template));
}

export function loadTodos(): TodoItem[] {
  const raw = localStorage.getItem(STORAGE_KEYS.todos);
  if (!raw) return defaultTodos();

  try {
    const parsed = JSON.parse(raw) as TodoItem[];
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Ignore invalid local storage state.
  }

  return defaultTodos();
}

export function persistTemplate(template: Template) {
  localStorage.setItem(STORAGE_KEYS.template, JSON.stringify(template));
}

export function persistInputs(inputs: Record<string, string>[]) {
  localStorage.setItem(STORAGE_KEYS.inputs, JSON.stringify(inputs));
}

export function persistTodos(todos: TodoItem[]) {
  localStorage.setItem(STORAGE_KEYS.todos, JSON.stringify(todos));
}

export function persistLang(lang: string) {
  localStorage.setItem(STORAGE_KEYS.lang, lang);
}

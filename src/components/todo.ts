import type { TodoItem } from '../types/app';
import { escapeHtml } from '../utils/dom';

export function getTodoProgress(todos: TodoItem[]) {
  const done = todos.filter((todo) => todo.done).length;
  return { done, total: todos.length };
}

export function renderTodoItems(todos: TodoItem[]) {
  return todos
    .map(
      (todo) => `
        <button class="todo-item ${todo.done ? 'done' : ''}" data-todo-id="${todo.id}">
          <span class="todo-check">${todo.done ? '✓' : ''}</span>
          <span class="todo-text">
            <strong>${escapeHtml(todo.title)}</strong>
            <small>${escapeHtml(todo.details)}</small>
          </span>
        </button>
      `,
    )
    .join('');
}

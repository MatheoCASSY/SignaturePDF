import type { TodoItem } from '../types/app';

export const defaultTodos = (): TodoItem[] => [
  { id: 1, title: 'Se connecter', details: 'Passer par Cognito puis rejoindre la bonne page selon le role.', done: true },
  { id: 2, title: 'Construire le template', details: 'Utiliser la page admin pour composer le document et ses champs.', done: true },
  { id: 3, title: 'Publier et autoriser', details: 'Enregistrer dans S3 puis donner des acces simples ou multi-usages.', done: false },
  { id: 4, title: 'Signer et exporter', details: 'Ouvrir un document attribue, remplir les champs puis telecharger le PDF.', done: false },
];

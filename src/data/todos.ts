import type { TodoItem } from '../types/app';

export const defaultTodos = (): TodoItem[] => [
  { id: 1, title: 'Choisir le template', details: 'Prendre un modele ou charger un JSON.', done: true },
  { id: 2, title: 'Ajouter les champs', details: 'Utiliser la palette du designer pour construire le document.', done: true },
  { id: 3, title: 'Generer le PDF interactif', details: 'Exporter un PDF avec champs remplissables.', done: false },
  { id: 4, title: 'Remplir et recuperer', details: 'Saisir les donnees puis telecharger le PDF final.', done: false },
];

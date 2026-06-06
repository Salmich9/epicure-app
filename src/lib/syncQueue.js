/**
 * File d'attente de synchronisation pour les mutations hors-ligne.
 * Les opérations en attente sont stockées dans localStorage et
 * exécutées dès que la connexion est rétablie.
 */

const QUEUE_KEY = 'epicure_sync_queue';

export const getQueue = () => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
};

export const enqueue = (operation) => {
  const queue = getQueue();
  const item = { ...operation, _id: `${Date.now()}_${Math.random()}`, _queued_at: new Date().toISOString() };
  queue.push(item);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return item._id;
};

export const dequeue = (id) => {
  const queue = getQueue().filter((op) => op._id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const clearQueue = () => localStorage.removeItem(QUEUE_KEY);

export const getQueueLength = () => getQueue().length;

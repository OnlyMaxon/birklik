// functions/src/index.ts
/**
 * Firebase Cloud Functions для Birklik.az
 * 
 * Основные функции:
 * - Еженедельная очистка данных (scheduled)
 * - Очистка хранилища (scheduled)
 * - Логирование операций
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { runAllCleanups } from './cleanup/firestore-cleanup';
import { runAllStorageCleanups } from './cleanup/storage-cleanup';

// Инициализируем Firebase Admin
admin.initializeApp();

/**
 * Еженедельная очистка Firestore (Каждый понедельник в 2:00 AM UTC)
 */
export const weeklyFirestoreCleanup = functions
  .region('europe-west1')
  .pubsub.schedule('every monday 02:00')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('[INFO] Starting weekly Firestore cleanup at', new Date());

    try {
      const results = await runAllCleanups();

      // Логируем summary
      await admin.firestore().collection('cleanup-logs').add({
        timestamp: new Date(),
        type: 'weekly_summary_firestore',
        totalCleanupsRun: results.length,
        successfulCleanupsRun: results.filter((r) => r.status === 'success')
          .length,
        totalItemsRemoved: results.reduce((sum, r) => sum + r.count, 0),
        results: results.map((r) => ({
          type: r.type,
          count: r.count,
          status: r.status,
          error: r.error,
        })),
      });

      console.log('[SUCCESS] Firestore cleanup completed');
      return null;
    } catch (error) {
      console.error('[ERROR] Firestore cleanup failed:', error);

      // Логируем ошибку
      await admin.firestore().collection('cleanup-logs').add({
        timestamp: new Date(),
        type: 'weekly_firestore_cleanup_error',
        error: (error as any).message || 'Unknown error',
      });

      throw error;
    }
  });

/**
 * Еженедельная очистка Storage (Каждый вторник в 2:00 AM UTC)
 */
export const weeklyStorageCleanup = functions
  .region('europe-west1')
  .pubsub.schedule('every tuesday 02:00')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('[INFO] Starting weekly Storage cleanup at', new Date());

    try {
      const results = await runAllStorageCleanups();

      // Логируем summary
      await admin.firestore().collection('cleanup-logs').add({
        timestamp: new Date(),
        type: 'weekly_summary_storage',
        totalCleanupsRun: results.length,
        successfulCleanupsRun: results.filter((r) => r.status === 'success')
          .length,
        totalFilesDeleted: results.reduce((sum, r) => sum + r.count, 0),
        results: results.map((r) => ({
          type: r.type,
          count: r.count,
          status: r.status,
          error: r.error,
        })),
      });

      console.log('[SUCCESS] Storage cleanup completed');
      return null;
    } catch (error) {
      console.error('[ERROR] Storage cleanup failed:', error);

      // Логируем ошибку
      await admin.firestore().collection('cleanup-logs').add({
        timestamp: new Date(),
        type: 'weekly_storage_cleanup_error',
        error: (error as any).message || 'Unknown error',
      });

      throw error;
    }
  });

/**
 * HTTP функция для ручного запуска cleanup (для тестирования)
 * Требует authentication и правильный токен
 */
export const manualCleanup = functions
  .region('europe-west1')
  .https.onRequest(async (req, res) => {
    // Проверяем authorization
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token || token !== process.env.CLEANUP_TOKEN) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Проверяем метод
    if (req.method !== 'POST') {
      return res.status(400).json({ error: 'Method not allowed' });
    }

    const dryRun = req.body.dryRun === true;

    console.log(
      `[INFO] Manual cleanup requested (dryRun: ${dryRun}) by ${req.ip}`
    );

    try {
      let results: any[] = [];

      if (!dryRun) {
        const firestoreResults = await runAllCleanups();
        const storageResults = await runAllStorageCleanups();

        results = [...firestoreResults, ...storageResults];
      }

      return res.json({
        success: true,
        dryRun,
        results: results.map((r) => ({
          type: r.type,
          count: r.count,
          status: r.status,
          duration: r.duration,
        })),
      });
    } catch (error) {
      console.error('[ERROR] Manual cleanup failed:', error);

      return res.status(500).json({
        success: false,
        error: (error as any).message || 'Unknown error',
      });
    }
  });

console.log('✅ Cloud Functions initialized');

#!/usr/bin/env ts-node
// functions/src/cleanup/admin.ts
/**
 * Admin script для запуска cleanup вручную
 * 
 * Использование:
 * pnpm cleanup:dry      -- Показывает что удалится (сухой прогон)
 * pnpm cleanup:execute  -- Реально удаляет
 */

import {admin} from '../firebase-admin';
import * as path from 'path';
import { runAllCleanups } from './firestore-cleanup';
import { runAllStorageCleanups } from './storage-cleanup';

// Инициализируем Firebase Admin
const serviceAccountPath = path.join(
  __dirname,
  '../../serviceAccountKey.json'
);

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    storageBucket: 'birklik-65289.firebasestorage.app',
  });
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error);
  process.exit(1);
}

interface CommandOptions {
  dryRun: boolean;
  verbose: boolean;
}

/** Вопрос в терминал с ответом по умолчанию «нет». */
function askYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    readline.question(question, (answer: string) => {
      readline.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

/**
 * Парсит command line аргументы
 */
function parseArgs(): CommandOptions {
  const args = process.argv.slice(2);

  return {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
  };
}

/**
 * Выводит красивый отчет
 */
function printReport(results: any[], title: string): void {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));

  let totalCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let totalDuration = 0;

  for (const result of results) {
    const status = result.status === 'success' ? '✅' : '❌';
    console.log(
      `${status} ${result.type.toUpperCase()}: ${result.count} items (${result.duration}ms)`
    );

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }

    totalCount += result.count;
    totalDuration += result.duration;

    if (result.status === 'success') {
      successCount++;
    } else {
      failureCount++;
    }
  }

  console.log('='.repeat(60));
  console.log(
    `Total: ${totalCount} items removed, ${totalDuration}ms (${successCount}/${results.length} successful)`
  );
  console.log('='.repeat(60) + '\n');
}

/**
 * Запускает cleanup процесс
 */
async function main(): Promise<void> {
  const options = parseArgs();

  console.log('🧹 Birklik.az Cleanup Utility');
  console.log('');

  if (options.dryRun) {
    console.log(
      '📋 DRY RUN MODE - Ничего не будет удалено, только показываем результаты'
    );
  } else {
    // Подтверждение спрашивается по-настоящему. Раньше здесь печаталось
    // «Уверены? (Y/n)», а ответа никто не ждал — закомментированный prompt
    // создавал полную видимость защиты и тут же удалял данные.
    const confirmed = await askYesNo(
      '⚠️  РЕЖИМ УДАЛЕНИЯ. Данные будут удалены безвозвратно. Продолжить? (y/N) '
    );
    if (!confirmed) {
      console.log('Отменено.');
      process.exit(0);
    }
  }

  console.log('');

  if (options.dryRun) {
    console.log('📋 Dry-run: реальное удаление пропускается. Запустите pnpm cleanup:execute для выполнения.\n');
    process.exit(0);
  }

  try {
    console.log('▶️  Starting Firestore cleanup...');
    const firestoreResults = await runAllCleanups();
    printReport(firestoreResults, 'Firestore Cleanup Results');

    console.log('▶️  Starting Storage cleanup...');
    const storageResults = await runAllStorageCleanups();
    printReport(storageResults, 'Storage Cleanup Results');

    const totalFirestore = firestoreResults.reduce((sum, r) => sum + r.count, 0);
    const totalStorage = storageResults.reduce((sum, r) => sum + r.count, 0);

    console.log('📊 TOTAL SUMMARY');
    console.log(`   Firestore items removed: ${totalFirestore}`);
    console.log(`   Storage files deleted: ${totalStorage}`);
    console.log(`   Total operations: ${totalFirestore + totalStorage}`);
    console.log('\n✅ CLEANUP COMPLETED SUCCESSFULLY');

    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Запускаем
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

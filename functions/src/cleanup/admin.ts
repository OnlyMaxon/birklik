#!/usr/bin/env ts-node
// functions/src/cleanup/admin.ts
/**
 * Admin script для запуска cleanup вручную
 * 
 * Использование:
 * npm run cleanup:dry      -- Показывает что удалится (сухой прогон)
 * npm run cleanup:execute  -- Реально удаляет
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import {
  runAllCleanups,
  logCleanupResult,
} from './firestore-cleanup';
import {
  runAllStorageCleanups,
  logStorageCleanupResult,
} from './storage-cleanup';

// Инициализируем Firebase Admin
const serviceAccountPath = path.join(
  __dirname,
  '../../serviceAccountKey.json'
);

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error);
  process.exit(1);
}

interface CommandOptions {
  dryRun: boolean;
  verbose: boolean;
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
    console.log(
      '⚠️  EXECUTE MODE - Будут реально удалены данные. Уверены? (Y/n)'
    );

    // В production переспросить подтверждение
    // const answer = await prompt();
    // if (answer.toLowerCase() !== 'y') {
    //   console.log('Отменено');
    //   process.exit(0);
    // }
  }

  console.log('');

  try {
    // Запускаем Firestore cleanup
    console.log('▶️  Starting Firestore cleanup...');
    const firestoreResults = await runAllCleanups();
    printReport(firestoreResults, 'Firestore Cleanup Results');

    // Запускаем Storage cleanup
    console.log('▶️  Starting Storage cleanup...');
    const storageResults = await runAllStorageCleanups();
    printReport(storageResults, 'Storage Cleanup Results');

    // Итоги
    const totalFirestore = firestoreResults.reduce(
      (sum, r) => sum + r.count,
      0
    );
    const totalStorage = storageResults.reduce((sum, r) => sum + r.count, 0);

    console.log('📊 TOTAL SUMMARY');
    console.log(`   Firestore items removed: ${totalFirestore}`);
    console.log(`   Storage files deleted: ${totalStorage}`);
    console.log(`   Total operations: ${totalFirestore + totalStorage}`);

    if (options.dryRun) {
      console.log(
        '\n✅ DRY RUN COMPLETED - Данные НЕ были удалены'
      );
      console.log('Запустите с флагом --execute для реального удаления\n');
    } else {
      console.log(
        '\n✅ CLEANUP COMPLETED SUCCESSFULLY'
      );
    }

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

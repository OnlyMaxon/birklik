#!/usr/bin/env ts-node
// functions/src/cleanup/storage-orphans.ts
/**
 * Удаление осиротевших файлов из Storage (папка properties/).
 *
 * Отдельный инструмент, НЕ трогающий Firestore-документы — в отличие от
 * `npm run cleanup:execute`, который заодно удаляет объявления.
 *
 * Использование:
 *   npm run storage:audit                     -- только отчёт, ничего не удаляет
 *   npm run storage:backup                    -- скачать кандидатов на удаление локально
 *   npm run storage:purge -- --execute        -- реальное удаление
 *
 * Флаги:
 *   --execute            без него скрипт всегда работает в режиме отчёта
 *   --backup <dir>       скачать файлы перед удалением (по умолчанию ./storage-backup)
 *   --min-age-days <N>   не трогать файлы моложе N дней (по умолчанию 30)
 *   --limit <N>          удалить не больше N файлов за прогон
 *   --prefix <path>      папка Storage (по умолчанию properties/)
 */

import {admin} from '../firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    storageBucket: 'birklik-65289.firebasestorage.app',
  });
} catch (error) {
  console.error('Не удалось инициализировать Firebase Admin:', error);
  process.exit(1);
}

/**
 * Максимальная глубина обхода подколлекций. Защита от бесконечной рекурсии,
 * реальная вложенность здесь — users/{id}/notifications, то есть 2.
 */
const MAX_DEPTH = 5;

interface Options {
  execute: boolean;
  backupDir: string | null;
  minAgeDays: number;
  limit: number;
  prefix: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  // Значение следом за флагом. Если там другой флаг (`--backup --execute`),
  // значения нет — иначе каталогом бэкапа стало бы слово "--execute".
  const value = (flag: string): string | null => {
    const i = args.indexOf(flag);
    if (i === -1) return null;
    const next = args[i + 1];
    return next && !next.startsWith('--') ? next : null;
  };

  const backupFlag = args.indexOf('--backup');
  const minAge = value('--min-age-days');
  const limit = value('--limit');

  return {
    execute: args.includes('--execute'),
    backupDir: backupFlag === -1 ? null : value('--backup') || './storage-backup',
    minAgeDays: minAge ? Number(minAge) : 30,
    limit: limit ? Number(limit) : Infinity,
    prefix: value('--prefix') || 'properties/',
  };
}

/**
 * Достаёт Storage-путь из legacy download-URL или /api/images URL.
 * https://.../o/properties%2Fuid%2F123_a.jpg?alt=media  →  properties/uid/123_a.jpg
 *
 * Сравнение идёт по декодированному пути, а не по подстроке в URL: так файл
 * с необычным символом в имени не будет ошибочно принят за сироту.
 */
function extractStoragePaths(text: string): string[] {
  const out: string[] = [];
  for (const re of [/\/o\/([^"?\s\\]+)/g, /\/api\/images\/([^"?\s\\]+)/g]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      try {
        out.push(decodeURIComponent(m[1]));
      } catch {
        // повреждённый URL — пропускаем, файл при этом останется жив
      }
    }
  }
  return out;
}

/**
 * Собирает все Storage-пути, на которые ссылается хоть один документ.
 *
 * Обход рекурсивный и без списка коллекций: читаются ВСЕ корневые коллекции и
 * все подколлекции каждого документа. Список коллекций руками — источник тихих
 * ошибок: например, `notifications` лежит в `users/{id}/notifications`, и
 * обращение к корневой коллекции с тем же именем возвращает пусто.
 */
async function collectReferencedPaths(): Promise<{ paths: Set<string>; scanned: number }> {
  const db = admin.firestore();
  const referenced = new Set<string>();
  let scanned = 0;
  let collections = 0;

  const walk = async (
    col: FirebaseFirestore.CollectionReference,
    label: string,
    depth: number
  ): Promise<void> => {
    if (depth > MAX_DEPTH) {
      console.warn(`  ⚠️  превышена глубина вложенности на ${label} — пропускаю`);
      return;
    }
    collections++;
    const snap = await col.get();
    scanned += snap.size;

    for (const doc of snap.docs) {
      for (const p of extractStoragePaths(JSON.stringify(doc.data()))) {
        referenced.add(p);
      }
      for (const sub of await doc.ref.listCollections()) {
        await walk(sub, `${label}/${sub.id}`, depth + 1);
      }
    }
  };

  for (const col of await db.listCollections()) {
    await walk(col, col.id, 1);
    console.log(`  ${col.id}`);
  }

  console.log(`  коллекций пройдено: ${collections}, документов: ${scanned}`);
  return { paths: referenced, scanned };
}

/** Выполняет задачи пачками, чтобы не открывать 1000 соединений разом. */
async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

const mb = (bytes: number) => (bytes / 1048576).toFixed(1);
const line = '─'.repeat(64);

async function main(): Promise<void> {
  const opts = parseArgs();
  const bucket = admin.storage().bucket();

  console.log('🧹 Очистка осиротевших файлов Storage');
  console.log(opts.execute ? '⚠️  РЕЖИМ УДАЛЕНИЯ' : '📋 РЕЖИМ ОТЧЁТА — ничего не удаляется');
  console.log(`   папка: ${opts.prefix} | не трогать моложе ${opts.minAgeDays} дн.`);
  console.log('');

  console.log('Читаю Firestore...');
  const { paths: referenced, scanned } = await collectReferencedPaths();
  console.log(`  найдено ссылок на файлы: ${referenced.size}`);

  // Предохранитель: пустой набор ссылок означал бы, что сиротами станут ВСЕ файлы.
  // Такое бывает при сбое доступа к Firestore, а не потому что мусор — всё хранилище.
  if (referenced.size === 0 || scanned === 0) {
    console.error('\n❌ Firestore не вернул ни одной ссылки. Прерываю — иначе удалятся все файлы.');
    process.exit(1);
  }

  console.log('\nЧитаю Storage...');
  const [files] = await bucket.getFiles({ prefix: opts.prefix });
  console.log(`  файлов: ${files.length}`);

  const cutoff = Date.now() - opts.minAgeDays * 86400000;
  const orphans: { file: (typeof files)[number]; size: number }[] = [];
  let usedCount = 0;
  let tooYoung = 0;

  for (const file of files) {
    // properties/{userId}/{файл} — записи короче являются самой папкой
    if (file.name.split('/').length < 3) continue;

    if (referenced.has(file.name)) {
      usedCount++;
      continue;
    }
    if (new Date(file.metadata.updated as string).getTime() > cutoff) {
      tooYoung++;
      continue;
    }
    orphans.push({ file, size: Number(file.metadata.size || 0) });
  }

  orphans.sort((a, b) => String(a.file.metadata.updated).localeCompare(String(b.file.metadata.updated)));
  const targets = orphans.slice(0, opts.limit === Infinity ? orphans.length : opts.limit);
  const totalBytes = targets.reduce((s, o) => s + o.size, 0);

  console.log('\n' + line);
  console.log('ИТОГО');
  console.log(line);
  console.log(`  используется объявлениями: ${usedCount}`);
  console.log(`  свежих (моложе ${opts.minAgeDays} дн., пропускаем): ${tooYoung}`);
  console.log(`  под удаление: ${targets.length} файлов, ${mb(totalBytes)} MB`);
  if (targets.length < orphans.length) {
    console.log(`  (ограничено --limit, всего сирот ${orphans.length})`);
  }

  if (targets.length === 0) {
    console.log('\n✅ Удалять нечего.');
    process.exit(0);
  }

  // Полный список кандидатов — на случай если после удаления что-то понадобится найти
  const reportPath = path.join(__dirname, '../../storage-orphans-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      targets.map((o) => ({ name: o.file.name, size: o.size, updated: o.file.metadata.updated })),
      null,
      2
    )
  );
  console.log(`\n  список сохранён: ${reportPath}`);

  console.log('\n  первые 10:');
  for (const o of targets.slice(0, 10)) {
    console.log(`   ${String(o.file.metadata.updated).slice(0, 10)}  ${mb(o.size).padStart(6)} MB  ${o.file.name}`);
  }
  if (targets.length > 10) console.log(`   ...ещё ${targets.length - 10}`);

  if (opts.backupDir) {
    console.log(`\n💾 Скачиваю в ${opts.backupDir} ...`);
    let done = 0;
    await inBatches(targets, 10, async (o) => {
      const dest = path.join(opts.backupDir!, o.file.name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      await o.file.download({ destination: dest });
      if (++done % 100 === 0) console.log(`   ${done}/${targets.length}`);
    });
    console.log(`   готово: ${done} файлов`);
  }

  if (!opts.execute) {
    console.log('\n📋 Отчёт завершён. Ничего не удалено.');
    console.log('   Для удаления добавьте --execute (перед этим стоит сделать --backup).');
    process.exit(0);
  }

  console.log('\n🗑️  Удаляю...');
  const deleted: string[] = [];
  const failed: { name: string; error: string }[] = [];

  await inBatches(targets, 20, async (o) => {
    try {
      await o.file.delete();
      deleted.push(o.file.name);
      if (deleted.length % 100 === 0) console.log(`   ${deleted.length}/${targets.length}`);
    } catch (err: any) {
      failed.push({ name: o.file.name, error: err?.message || String(err) });
    }
  });

  console.log('\n' + line);
  console.log(`✅ Удалено: ${deleted.length} файлов, ${mb(totalBytes)} MB`);
  if (failed.length) {
    console.log(`❌ Не удалось: ${failed.length}`);
    for (const f of failed.slice(0, 10)) console.log(`   ${f.name}: ${f.error}`);
  }
  console.log(line);

  // Список удалённого остаётся в storage-orphans-report.json рядом со скриптом
  // и в выводе выше — в Firestore он больше не пишется.
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

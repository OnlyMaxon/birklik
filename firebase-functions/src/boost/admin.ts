#!/usr/bin/env ts-node
/**
 * Разбор пакетов подъёма руками.
 *
 * ```
 * pnpm boost:list   показывает незаконченные пакеты, НИЧЕГО не меняя
 * pnpm boost:run    прогоняет ночную задачу прямо сейчас
 * ```
 *
 * Зачем, если есть расписание: первую выкладку надо увидеть своими глазами, не
 * дожидаясь 01:00 UTC. И когда человек приходит со словами «купил, а не
 * подняли», отвечать надо по записи, а не по догадке.
 *
 * ⚠️ `boost:run` — ровно то же, что делает расписание, со всеми защитами:
 * подъём, случившийся меньше двадцати часов назад, НЕ расходуется повторно.
 * Поэтому запуск вручную рядом с ночным прогоном ничего не сжигает.
 *
 * ⚠️ Работает по ПРОДАКШЕНУ: ключ сервис-аккаунта лежит рядом с репозиторием и
 * в него не входит. Сухой прогон (`boost:list`) безопасен всегда.
 */

import * as path from 'path';
import {admin} from '../firebase-admin';
import {BOOSTS} from './apply-boost';
import {runDailyBoosts} from './daily-boosts';

const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
} catch (error) {
  console.error('Не удалось подключиться к Firebase:', error);
  process.exit(1);
}

async function list(): Promise<void> {
  const snapshot = await admin.firestore().collection(BOOSTS).get();

  if (snapshot.empty) {
    console.log('Незаконченных пакетов нет.');
    console.log(
      'Это нормально: пакет на один подъём записи не создаёт, а закончившийся удаляется.'
    );
    return;
  }

  console.log(`Незаконченных пакетов: ${snapshot.size}\n`);
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const property = await admin.firestore().collection('properties').doc(doc.id).get();
    const status = property.exists ? property.data()?.status : 'ОБЪЯВЛЕНИЯ НЕТ';
    const boostedAt = property.exists ? property.data()?.boostedAt : undefined;

    console.log(`объявление   ${doc.id}`);
    console.log(`  осталось   ${data.remaining} из ${data.total}`);
    console.log(`  последний  ${data.lastBumpAt ?? '—'}`);
    console.log(`  на витрине ${status}`);
    console.log(`  boostedAt  ${boostedAt ?? '—'}`);
    console.log(`  касса      ${data.source ?? '—'}`);
    console.log('');
  }
}

async function run(): Promise<void> {
  console.log('Прогон задачи подъёма…\n');
  const result = await runDailyBoosts();
  console.log(`поднято:            ${result.bumped}`);
  console.log(`пакетов закончилось ${result.finished}`);
  console.log(`пропущено:          ${result.skipped}`);
  console.log(`записей убрано:     ${result.removed}`);
  console.log('');
  console.log('Пропущенные — это либо подъём меньше 20 часов назад, либо');
  console.log('объявление не на витрине: такой пакет ждёт и дней не теряет.');
}

const command = process.argv[2];

if (command === '--run') {
  void run().then(() => process.exit(0));
} else if (command === '--list') {
  void list().then(() => process.exit(0));
} else {
  console.log('Укажите --list (ничего не меняет) или --run (прогоняет задачу).');
  process.exit(1);
}

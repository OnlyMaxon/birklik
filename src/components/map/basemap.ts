// Единый источник тайлов для всех карт сайта.
//
// CARTO с 2026 года требует ключ на растровых (PNG) тайлах. Тайл при этом
// по-прежнему отдаётся с кодом 200 — поверх картинки просто печатается
// «API KEY REQUIRED», поэтому ни один обработчик ошибок такое не поймает.
//
// Ключ бесплатный (5 млн тайлов в месяц) и публичный по своей природе: браузер
// шлёт его в каждом запросе тайла, спрятать нельзя. Отсюда NEXT_PUBLIC_, а не
// секрет воркера. Важно: Next подставляет NEXT_PUBLIC_-переменные в бандл на
// СБОРКЕ, поэтому ключ обязан лежать в env-файле во время `pnpm cf:build` —
// добавить его в `vars` воркера уже недостаточно.
//
// Без ключа откатываемся на тайлы OpenStreetMap: карта выглядит иначе, но
// остаётся читаемой и без надписи поперёк.
const cartoKey = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim()

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

// Субдомены {s} у CARTO живы, но в их документации по ключу их уже нет, да и
// под HTTP/2 дробление по хостам смысла не даёт. {r} Leaflet сам подставит
// пустой строкой, если retina-режим выключен.
export const BASEMAP_URL = cartoKey
  ? `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoKey}`
  : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export const BASEMAP_ATTRIBUTION = cartoKey
  ? `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`
  : OSM_ATTRIBUTION

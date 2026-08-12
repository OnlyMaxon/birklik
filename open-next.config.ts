import {defineCloudflareConfig} from '@opennextjs/cloudflare'

// Кэш инкрементальной регенерации живёт в Workers Static Assets: страницы
// property/[id] отдаются из кэша на пять минут (см. queries.ts), а ревалидацию
// по тегам делает сам Next при мутации. Внешнего KV/R2 для этого не требуется.
export default defineCloudflareConfig()

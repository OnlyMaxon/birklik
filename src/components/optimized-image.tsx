import Image, {type ImageProps} from 'next/image'
import {toImageApiUrl} from '@/lib/images'

type OptimizedImageProps = Omit<ImageProps, 'width' | 'height'> & {
  width?: number | `${number}`
  height?: number | `${number}`
}

export function OptimizedImage({src, alt, width = 800, height = 600, sizes = '(max-width: 768px) 100vw, 50vw', ...props}: OptimizedImageProps) {
  const normalizedSrc = typeof src === 'string' ? (toImageApiUrl(src) || src) : src
  const source = typeof normalizedSrc === 'string' ? normalizedSrc : ''
  const unoptimized = source.startsWith('blob:') || source.startsWith('data:') || source.startsWith('/api/images/')
  return <Image src={normalizedSrc} alt={alt} width={width} height={height} sizes={sizes} unoptimized={unoptimized} {...props} />
}

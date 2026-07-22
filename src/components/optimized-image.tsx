import Image, {type ImageProps} from 'next/image'

type OptimizedImageProps = Omit<ImageProps, 'width' | 'height'> & {
  width?: number | `${number}`
  height?: number | `${number}`
}

export function OptimizedImage({src, alt, width = 800, height = 600, sizes = '(max-width: 768px) 100vw, 50vw', ...props}: OptimizedImageProps) {
  const source = typeof src === 'string' ? src : ''
  const unoptimized = source.startsWith('blob:') || source.startsWith('data:')
  return <Image src={src} alt={alt} width={width} height={height} sizes={sizes} unoptimized={unoptimized} {...props} />
}

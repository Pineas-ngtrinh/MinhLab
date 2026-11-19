interface CloudinaryImageLoaderInput {
  src: string;
  width: number;
}

export function cloudinaryImageLoader({ src, width }: CloudinaryImageLoaderInput): string {
  const marker = '/image/upload/';
  const uploadIndex = src.indexOf(marker);
  if (uploadIndex === -1) return src;

  const prefix = src.slice(0, uploadIndex + marker.length);
  const path = src.slice(prefix.length);
  const versionIndex = path.search(/\/v\d+\//);
  const firstSlash = path.indexOf('/');
  const firstSegment = firstSlash === -1 ? path : path.slice(0, firstSlash);
  const hasTransform = versionIndex !== -1
    ? versionIndex > 0
    : firstSegment.startsWith('f_') || firstSegment.startsWith('q_') || firstSegment.startsWith('c_') || firstSegment.startsWith('t_') || firstSegment.includes(',');
  const transformPath = versionIndex !== -1
    ? path.slice(0, versionIndex)
    : hasTransform ? firstSegment : '';
  const assetPath = versionIndex !== -1
    ? path.slice(versionIndex)
    : hasTransform ? path.slice(firstSegment.length) : path;

  if (!transformPath) return `${prefix}f_auto,q_auto,w_${width},c_limit/${assetPath}`;

  const transforms = transformPath.split('/');
  const lastTransform = transforms[transforms.length - 1];
  if (lastTransform?.startsWith('t_')) {
    transforms.push(`f_auto,q_auto,w_${width},c_limit`);
  } else {
    transforms[transforms.length - 1] = `${lastTransform},w_${width},c_limit`;
  }
  return `${prefix}${transforms.join('/')}${assetPath}`;
}

import Image from 'next/image';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

export default function BrandMark({ size = 44, className }: BrandMarkProps) {
  return (
    <Image
      src="/icon.png"
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      priority
    />
  );
}

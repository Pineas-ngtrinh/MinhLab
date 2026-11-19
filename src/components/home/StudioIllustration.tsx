import Image from 'next/image';

export default function StudioIllustration({ scene }: { scene: 'collection' | 'workshop' | 'packing' }) {
  return (
    <div aria-hidden="true" className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
      <Image src={`/images/home/${scene}-detail.png`} alt="" fill sizes="(max-width: 640px) 112px, 128px" className="object-contain" />
    </div>
  );
}

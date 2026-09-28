import Image from "next/image";

export function BrandMark() {
  return (
    <span className="brand-mark" aria-label="Our Places">
      <span className="brand-mark__seal" aria-hidden="true">
        <Image
          src="/assets/arch-place-motif.svg"
          alt=""
          width={24}
          height={24}
        />
      </span>
      <span>Our Places</span>
    </span>
  );
}

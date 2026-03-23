import logoPath from "@assets/WhatsApp_Image_2026-03-01_at_10.45.20-removebg-preview_(1)_1772727577713.png";

interface ProtectedLogoProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "draggable"> {
  className?: string;
}

export default function ProtectedLogo({ className = "w-12 h-12 object-contain", style, ...rest }: ProtectedLogoProps) {
  const block = (e: React.MouseEvent | React.DragEvent) => e.preventDefault();
  return (
    <img
      {...rest}
      src={logoPath}
      alt={rest.alt ?? "NoteBeat Kids"}
      className={className}
      draggable={false}
      onContextMenu={block}
      onDragStart={block}
      style={{ userSelect: "none", WebkitUserSelect: "none", ...style }}
    />
  );
}

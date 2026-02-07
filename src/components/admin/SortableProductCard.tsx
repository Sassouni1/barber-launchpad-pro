import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { GripVertical, Edit2, Trash2, ExternalLink } from "lucide-react";

interface Product {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  button_text: string | null;
  order_index: number;
  image_position_x: number | null;
  image_position_y: number | null;
}

interface SortableProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
}

const SortableProductCard = ({ product, onEdit, onDelete }: SortableProductCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border border-border rounded-lg p-4 space-y-3 bg-card">
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-foreground flex-1 truncate">{product.title}</span>
      </div>
      {product.image_url && (
        <img
          src={product.image_url}
          alt={product.title}
          className="w-full h-56 object-cover rounded-md"
          style={{ objectPosition: `${product.image_position_x ?? 50}% ${product.image_position_y ?? 50}%` }}
        />
      )}
      {product.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
      )}
      {product.link_url && (
        <a
          href={product.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          {product.button_text || "View Product"}
        </a>
      )}
      <div className="flex gap-2 pt-2">
        <Button size="sm" variant="outline" onClick={() => onEdit(product)}>
          <Edit2 className="h-3 w-3 mr-1" />
          Edit
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onDelete(product.id)}>
          <Trash2 className="h-3 w-3 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
};

export default SortableProductCard;

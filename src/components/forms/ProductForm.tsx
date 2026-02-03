
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import type { RawMaterial } from '@/lib/data';
import { cn } from '@/lib/utils';

const recipeItemSchema = z.object({
  materialId: z.string().min(1, 'Please select a material.'),
  quantity: z.coerce.number().positive('Quantity must be > 0.'),
});

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  category: z.string().min(2, { message: 'Category is required.' }),
  price: z.coerce.number().min(0, { message: 'Price cannot be negative.' }),
  active: z.boolean().default(true),
  recipe: z.array(recipeItemSchema).optional(),
});

export type ProductFormData = z.infer<typeof formSchema>;

interface ProductFormProps {
  onSubmit: (values: ProductFormData) => void;
  initialData?: Partial<ProductFormData>;
  isSubmitting?: boolean;
  rawMaterials: RawMaterial[];
}

export function ProductForm({ onSubmit, initialData, isSubmitting, rawMaterials }: ProductFormProps) {
  const form = useForm<ProductFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      category: initialData?.category ?? '',
      price: initialData?.price ?? undefined,
      active: initialData?.active ?? true,
      recipe: initialData?.recipe ?? [],
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'recipe',
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Cappuccino" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Coffee" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Selling Price</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">IDR</span>
                    <Input type="number" className="pl-9" placeholder="0" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4 rounded-md border p-4">
          <h3 className="text-lg font-medium">Recipe (Bill of Materials)</h3>
          <div className="space-y-2">
            {fields.map((field, index) => {
              const selectedMaterial = rawMaterials.find(m => m.id === form.watch(`recipe.${index}.materialId`));
              return (
              <div key={field.id} className="flex items-end gap-2">
                <FormField
                  control={form.control}
                  name={`recipe.${index}.materialId`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className={cn(index !== 0 && "sr-only")}>Material</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a material" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {rawMaterials.filter(m => m.id !== '_init').map(material => (
                            <SelectItem key={material.id} value={material.id}>
                              {material.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`recipe.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem className="w-32">
                     <FormLabel className={cn(index !== 0 && "sr-only")}>Quantity</FormLabel>
                     <FormControl>
                        <div className="relative">
                            <Input type="number" placeholder="0" {...field} />
                            {selectedMaterial && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{selectedMaterial.unit}</span>}
                        </div>
                     </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )})}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ materialId: '', quantity: 0 })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Ingredient
          </Button>
           <FormDescription>
            Define the raw materials required to make one unit of this product. The cost will be calculated automatically.
          </FormDescription>
        </div>
        
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Product Active</FormLabel>
                <FormDescription>
                  Inactive products will not appear on the POS.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Saving Product...' : 'Save Product'}
        </Button>
      </form>
    </Form>
  );
}

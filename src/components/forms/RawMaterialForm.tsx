
'use client';

import { useForm } from 'react-hook-form';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RawMaterial } from '@/lib/data';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  unit: z.enum(['kg', 'g', 'L', 'mL', 'pcs']),
  stock: z.coerce.number().min(0, { message: 'Stock cannot be negative.' }),
  minimumStock: z.coerce
    .number()
    .min(0, { message: 'Minimum stock cannot be negative.' }),
  averageCost: z.coerce.number().min(0, { message: 'Initial cost must be a positive number.' }).optional(),
});

export type RawMaterialFormData = z.infer<typeof formSchema>;

interface RawMaterialFormProps {
  onSubmit: (values: RawMaterialFormData) => void;
  initialData?: Partial<RawMaterial>;
  isSubmitting?: boolean;
}

export function RawMaterialForm({
  onSubmit,
  initialData,
  isSubmitting,
}: RawMaterialFormProps) {
  const form = useForm<RawMaterialFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      unit: initialData?.unit ?? 'g',
      stock: initialData?.stock ?? 0,
      minimumStock: initialData?.minimumStock ?? 0,
      averageCost: initialData?.averageCost ?? 0,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Item Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Coffee Beans" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a unit" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="kg">Kilogram (kg)</SelectItem>
                    <SelectItem value="g">Gram (g)</SelectItem>
                    <SelectItem value="L">Liter (L)</SelectItem>
                    <SelectItem value="mL">Milliliter (mL)</SelectItem>
                    <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="stock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Initial Stock</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="minimumStock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum Stock Level</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} />
                </FormControl>
                 <FormDescription>Low stock warning level.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="averageCost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Initial Average Cost</FormLabel>
                <FormControl>
                   <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">IDR</span>
                        <Input type="number" className="pl-9" placeholder="0" {...field} />
                    </div>
                </FormControl>
                <FormDescription>Cost per unit.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <Button type="submit" disabled={isSubmitting} className="w-full">
           {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Saving...' : 'Save Item'}
        </Button>
      </form>
    </Form>
  );
}

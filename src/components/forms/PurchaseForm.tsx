'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
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
import { useMemo } from 'react';
import { formatCurrency } from '@/lib/currency';

const formSchema = z.object({
  materialId: z.string().min(1, { message: 'Please select a material.' }),
  quantity: z.coerce.number().positive({ message: 'Quantity must be positive.' }),
  totalCost: z.coerce.number().positive({ message: 'Total cost must be positive.' }),
  supplier: z.string().optional(),
});

export type PurchaseFormData = z.infer<typeof formSchema>;

interface PurchaseFormProps {
  rawMaterials: RawMaterial[];
  selectedMaterialId?: string | null;
  onSubmit: (values: PurchaseFormData) => void;
  isSubmitting?: boolean;
}

export function PurchaseForm({
  rawMaterials,
  selectedMaterialId,
  onSubmit,
  isSubmitting,
}: PurchaseFormProps) {
  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      materialId: selectedMaterialId ?? '',
      quantity: undefined,
      totalCost: undefined,
      supplier: '',
    },
  });

  const selectedMaterial = useMemo(() => {
    const id = form.watch('materialId');
    return rawMaterials.find(m => m.id === id);
  }, [form, rawMaterials]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="materialId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Raw Material</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={isSubmitting || !!selectedMaterialId}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a material to purchase" />
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
        
        <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
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
            <FormField
              control={form.control}
              name="totalCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Cost</FormLabel>
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

        <FormField
          control={form.control}
          name="supplier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Supplier (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Supplier Jaya Abadi" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" disabled={isSubmitting} className="w-full">
           {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Recording...' : 'Record Purchase'}
        </Button>
      </form>
    </Form>
  );
}

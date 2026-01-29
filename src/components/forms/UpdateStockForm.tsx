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
import type { RawMaterial } from '@/lib/data';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  quantity: z.coerce
    .number()
    .positive({ message: 'Purchase quantity must be positive.' }),
});

export type UpdateStockFormData = z.infer<typeof formSchema>;

interface UpdateStockFormProps {
  item: RawMaterial;
  onSubmit: (values: UpdateStockFormData) => void;
  isSubmitting?: boolean;
}

export function UpdateStockForm({
  item,
  onSubmit,
  isSubmitting,
}: UpdateStockFormProps) {
  const form = useForm<UpdateStockFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: undefined,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div>
            <h3 className="text-lg font-medium">{item.name}</h3>
            <p className="text-sm text-muted-foreground">Current Stock: {item.stock} {item.unit}</p>
        </div>
        <FormField
          control={form.control}
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity Purchased</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Enter quantity" {...field} />
              </FormControl>
              <FormDescription>The amount of stock you are adding.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" disabled={isSubmitting} className="w-full">
           {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Updating...' : 'Update Stock'}
        </Button>
      </form>
    </Form>
  );
}

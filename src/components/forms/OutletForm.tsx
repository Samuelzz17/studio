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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import type { OutletInfo } from '@/lib/data';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  code: z.string().min(2, { message: 'Code must be at least 2 characters.' }).max(5, { message: 'Code cannot be more than 5 characters.' }),
  address: z.string().optional(),
  phone: z.string().optional(),
  active: z.boolean().default(true),
});

export type OutletFormData = z.infer<typeof formSchema>;

interface OutletFormProps {
  onSubmit: (values: OutletFormData) => void;
  initialData?: Partial<OutletInfo>;
  isSubmitting?: boolean;
}

export function OutletForm({
  onSubmit,
  initialData,
  isSubmitting,
}: OutletFormProps) {
  const form = useForm<OutletFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      code: initialData?.code ?? '',
      address: initialData?.address ?? '',
      phone: initialData?.phone ?? '',
      active: initialData?.active ?? true,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Outlet Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Main Branch" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Outlet Code</FormLabel>
              <FormControl>
                <Input placeholder="e.g. MNB" {...field} />
              </FormControl>
              <FormDescription>A short code for the outlet (max 5 chars).</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter the full address of the outlet"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g. 08123456789" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Outlet Active</FormLabel>
                <FormDescription>
                  Inactive outlets cannot be selected and will not appear in reports.
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
          {isSubmitting ? 'Saving...' : 'Save Outlet'}
        </Button>
      </form>
    </Form>
  );
}

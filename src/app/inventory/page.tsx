import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { inventory } from '@/lib/data';
import { FilePlus, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function getStockStatus(stock: number, lowStockThreshold: number) {
  if (stock === 0) return 'outline';
  if (stock <= lowStockThreshold) return 'destructive';
  return 'default';
}

function getStockStatusText(stock: number, lowStockThreshold: number) {
  if (stock === 0) return 'Out of Stock';
  if (stock <= lowStockThreshold) return 'Low Stock';
  return 'In Stock';
}

export default function InventoryPage() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <div className="flex-1">
          <h1 className="font-headline text-xl font-semibold md:text-2xl">
            Inventory
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline">
            Export
          </Button>
          <Button size="sm">
            <FilePlus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Inventory Items</CardTitle>
            <CardDescription>
              Track and manage stock levels for all your ingredients and supplies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Stock Level
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Progress
                        value={(item.stock / (item.lowStockThreshold * 2)) * 100}
                        className="h-2"
                      />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge
                        variant={getStockStatus(item.stock, item.lowStockThreshold)}
                      >
                        {getStockStatusText(item.stock, item.lowStockThreshold)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.stock} {item.unit}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuItem>Adjust Stock</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

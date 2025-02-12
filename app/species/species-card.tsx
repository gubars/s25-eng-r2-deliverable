"use client";
/*
Note: "use client" is a Next.js App Router directive that tells React to render the component as
a client component rather than a server component. This establishes the server-client boundary,
providing access to client-side functionality such as hooks and event handlers to this component and
any of its imported children. Although the SpeciesCard component itself does not use any client-side
functionality, it is beneficial to move it to the client because it is rendered in a list with a unique
key prop in species/page.tsx. When multiple component instances are rendered from a list, React uses the unique key prop
on the client-side to correctly match component state and props should the order of the list ever change.
React server components don't track state between rerenders, so leaving the uniquely identified components (e.g. SpeciesCard)
can cause errors with matching props and state in child components if the list order changes.
*/
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { createBrowserSupabaseClient } from "@/lib/client-utils";
import type { Database } from "@/lib/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type BaseSyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

type Species = Database["public"]["Tables"]["species"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// We use zod (z) to define a schema for the "Add species" form.
// zod handles validation of the input values with methods like .string(), .nullable(). It also processes the form inputs with .transform() before the inputs are sent to the database.

// Define kingdom enum for use in Zod schema and displaying dropdown options in the form
const kingdoms = z.enum(["Animalia", "Plantae", "Fungi", "Protista", "Archaea", "Bacteria"]);

// Use Zod to define the shape + requirements of a Species entry; used in form validation
const speciesSchema = z.object({
  scientific_name: z
    .string()
    .trim()
    .min(1)
    .transform((val) => val?.trim()),
  common_name: z
    .string()
    .nullable()
    // Transform empty string or only whitespace input to null before form submission, and trim whitespace otherwise
    .transform((val) => (!val || val.trim() === "" ? null : val.trim())),
  kingdom: kingdoms,
  total_population: z.number().int().positive().min(1).nullable(),
  image: z
    .string()
    .url()
    .nullable()
    // Transform empty string or only whitespace input to null before form submission, and trim whitespace otherwise
    .transform((val) => (!val || val.trim() === "" ? null : val.trim())),
  description: z
    .string()
    .nullable()
    // Transform empty string or only whitespace input to null before form submission, and trim whitespace otherwise
    .transform((val) => (!val || val.trim() === "" ? null : val.trim())),
});

type FormData = z.infer<typeof speciesSchema>;

// Default values for the form fields.
/* Because the react-hook-form (RHF) used here is a controlled form (not an uncontrolled form),
fields that are nullable/not required should explicitly be set to `null` by default.
Otherwise, they will be `undefined` by default, which will raise warnings because `undefined` conflicts with controlled components.
All form fields should be set to non-undefined default values.
Read more here: https://legacy.react-hook-form.com/api/useform/
*/

export default function SpeciesCard({
  species,
  author,
  sessionId,
}: {
  species: Species;
  author: Profile;
  sessionId: string;
}) {
  const router = useRouter();

  // Control open/closed state of the dialog
  const [editOpen, setEditOpen] = useState<boolean>(false);

  // Instantiate form functionality with React Hook Form, passing in the Zod schema (for validation) and default values
  const form = useForm<FormData>({
    resolver: zodResolver(speciesSchema),
    defaultValues: {
      scientific_name: species.scientific_name,
      common_name: species.common_name,
      kingdom: species.kingdom,
      total_population: species.total_population,
      image: species.image,
      description: species.description,
    },
    mode: "onChange",
  });

  const handleEditSubmit = async (input: FormData) => {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from("species")
      .update({
        common_name: input.common_name,
        description: input.description,
        kingdom: input.kingdom,
        scientific_name: input.scientific_name,
        total_population: input.total_population,
        image: input.image,
      })
      .eq("id", species.id);

    // Catch and report errors from Supabase and exit the onSubmit function with an early 'return' if an error occurred.
    if (error) {
      return toast({
        title: "Something went wrong.",
        description: error.message,
        variant: "destructive",
      });
    }

    // Because Supabase errors were caught above, the remainder of the function will only execute upon a successful edit

    // Reset form values to the default (empty) values.
    // Practically, this line can be removed because router.refresh() also resets the form. However, we left it as a reminder that you should generally consider form "cleanup" after an add/edit operation.
    form.reset(input);

    setEditOpen(false);

    // Refresh all server components in the current route. This helps display the newly created species because species are fetched in a server component, species/page.tsx.
    // Refreshing that server component will display the new species from Supabase
    router.refresh();

    return toast({
      title: "Species edited!",
      description: "Successfully edited " + input.scientific_name + ".",
    });
  };

  const handleDeleteSpecies = async () => {
    if (!window.confirm("Are you sure you want to delete this species?")) return;

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.from("species").delete().eq("id", species.id);

      if (error) throw new Error(error.message);

      toast({ title: "Species deleted successfully!" });
      router.refresh();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred";
      console.error("Error deleting species:", errorMessage);
      toast({ title: "Deletion failed", description: errorMessage, variant: "destructive" });
    }
  };

  return (
    <Dialog>
      <div className="m-4 w-72 min-w-72 flex-none rounded border-2 p-3 shadow">
        {species.image && (
          <div className="relative h-40 w-full">
            <Image src={species.image} alt={species.scientific_name} fill style={{ objectFit: "cover" }} />
          </div>
        )}
        <h3 className="mt-3 text-2xl font-semibold">{species.scientific_name}</h3>
        <h4 className="text-lg font-light italic">{species.common_name}</h4>
        <p>{species.description ? species.description.slice(0, 150).trim() + "..." : ""}</p>
        <DialogTrigger asChild>
          <Button className="mt-3 w-full">Learn More</Button>
        </DialogTrigger>
      </div>

      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {/* Displays the scientific name of the species if exists.*/}
            <strong>Scientific Name:</strong> {species.scientific_name ?? "No scientific name available."}
          </DialogTitle>
          <DialogDescription>
            {/* Displays the common name of the species if exists.*/}
            <strong>Common Name:</strong> {species.common_name ?? "No common name available."}
          </DialogDescription>
        </DialogHeader>
        {/* Displays the image of the species if exists.*/}
        {species.image && (
          <div className="relative mt-4 h-60 w-full">
            <Image
              src={species.image}
              alt={species.scientific_name}
              layout="fill"
              className="rounded-md object-cover"
            />
          </div>
        )}

        <div className="mt-4 space-y-3">
          <h3 className="text-lg font-semibold">Species Information</h3>
          <p>
            {/* Displays the kingdom of the species if exists.*/}
            <strong>Kingdom:</strong> {species.kingdom ?? "No kingdom available."}
          </p>
          <p>
            {/* Displays the population of the species as a string if exists.*/}
            <strong>Total Population:</strong>{" "}
            {species.total_population?.toLocaleString() ?? "No population data available."}
          </p>
          <p>
            {/* Displays the description of the species if exists.*/}
            <strong>Description:</strong> {species.description ?? "No description available."}
          </p>

          <Separator className="my-4" />

          <h3 className="text-lg font-semibold">Author Information</h3>
          <p>
            {/* Displays the display name of the author if exists.*/}
            <strong>Display Name:</strong> {author.display_name ?? "No display name available."}
          </p>
          <p>
            {/* Displays the email of the author if exists.*/}
            <strong>Email:</strong> {author.email ?? "No email address available."}
          </p>
          <p>
            {/* Displays the biography of the author if exists.*/}
            <strong>Biography:</strong> {author.biography ?? "No biography available."}
          </p>
        </div>

        {/* Only show these buttons if user is the author */}
        {sessionId === species.author && (
          <div className="mt-4 flex gap-2">
            {/* Opens the edit species dialog */}
            <DialogTrigger asChild>
              <Button onClick={() => setEditOpen(true)} type="submit" className="ml-1 mr-1 flex-auto">
                Edit Species
              </Button>
            </DialogTrigger>

            {/* Deletes the species */}
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                {
                  /* Ensures delete function occurs */
                }
                void handleDeleteSpecies();
              }}
            >
              Delete Species
            </Button>
          </div>
        )}
      </DialogContent>

      {/* Edit Species Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-screen overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Species</DialogTitle>
            <DialogDescription>
              Edit a species here. Click &quot;Edit Species&quot; below when you&apos;re done.
            </DialogDescription>
          </DialogHeader>

          {/* Editing form */}
          <Form {...form}>
            <form onSubmit={(e: BaseSyntheticEvent) => void form.handleSubmit(handleEditSubmit)(e)}>
              <div className="grid w-full items-center gap-4">
                <FormField
                  control={form.control}
                  name="scientific_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scientific Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Cavia porcellus" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="common_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Common Name</FormLabel>
                      <FormControl>
                        <Input
                          value={field.value ?? ""}
                          placeholder="Guinea pig"
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="kingdom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kingdom</FormLabel>
                      <Select onValueChange={(value) => field.onChange(kingdoms.parse(value))} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a kingdom" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            {kingdoms.options.map((kingdom) => (
                              <SelectItem key={kingdom} value={kingdom}>
                                {kingdom}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="total_population"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total population</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value !== null ? String(field.value) : ""}
                          onChange={(event) => {
                            const newValue = event.target.value;
                            field.onChange(newValue === "" ? null : parseInt(newValue, 10));
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="image"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          value={field.value ?? ""}
                          placeholder="https://example.com/image.jpg"
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          value={field.value ?? ""} // Handle nullable values
                          placeholder="Enter species description..."
                          onChange={(e) => field.onChange(e.target.value || null)} // Convert empty input to null
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex">
                  <Button type="submit" className="ml-1 mr-1 flex-auto">
                    Save Changes
                  </Button>
                  <Button
                    type="button"
                    className="ml-1 mr-1 flex-auto"
                    variant="secondary"
                    onClick={() => setEditOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

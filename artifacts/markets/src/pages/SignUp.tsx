import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Activity, ArrowRight, Loader2, Lock, Mail, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function SignUp() {
  const [_, setLocation] = useLocation();
  const { register } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: RegisterFormValues) {
    try {
      setIsLoading(true);
      await register(data.email, data.password, data.name);
      toast({
        title: "Registration successful",
        description: "Your operator profile has been created.",
      });
      setLocation("/");
    } catch (err: any) {
      toast({
        title: "Registration failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass-panel p-8 rounded-2xl relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col items-center mb-8">
            <img
              src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.png`}
              alt="THEA"
              className="h-16 w-auto object-contain mb-6 logo-pulse"
            />
            <h1 className="text-3xl font-display font-bold text-white mb-2 tracking-tight">New Operator</h1>
            <p className="text-muted-foreground text-center">Establish your identity on the THEA network.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 relative z-10">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground uppercase text-xs tracking-wider">Designation (Name)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="Neo" 
                          className="pl-10 bg-secondary/30 border-primary/20 focus:border-primary/50 text-white placeholder:text-white/20 h-12" 
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground uppercase text-xs tracking-wider">Comms Channel (Email)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="neo@thea.network" 
                          className="pl-10 bg-secondary/30 border-primary/20 focus:border-primary/50 text-white placeholder:text-white/20 h-12" 
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground uppercase text-xs tracking-wider">Security Key (Password)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          className="pl-10 bg-secondary/30 border-primary/20 focus:border-primary/50 text-white placeholder:text-white/20 h-12" 
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold group relative overflow-hidden" 
                disabled={isLoading}
              >
                <div className="absolute inset-0 bg-primary/20 group-hover:bg-primary/30 transition-colors" />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Register Identity
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </Button>
            </form>
          </Form>

          <div className="mt-8 pt-6 border-t border-primary/10 text-center relative z-10">
            <p className="text-muted-foreground text-sm">
              Already established?{" "}
              <Link href="/sign-in" className="text-primary hover:text-primary/80 font-medium transition-colors">
                Authenticate here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

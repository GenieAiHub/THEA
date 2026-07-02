export const Footer = () => {
  return (
    <footer className="border-t border-white/10 py-16 px-8 bg-background relative z-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex flex-col items-center md:items-start">
          <div className="font-display font-bold text-3xl tracking-tighter mb-2 text-white">THEA</div>
          <div className="text-sm text-muted-foreground">
            Total Human Engagement Analytics
          </div>
        </div>
        
        <div className="flex gap-8 text-sm text-muted-foreground">
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-white transition-colors">Security</a>
        </div>
        
        <div className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} THEA Intelligence. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

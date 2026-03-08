// Update this page (the content is just a fallback if you fail to update the page)

import { Navbar } from "@/components/Navbar";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground">Welcome to TennisAI</h1>
          <p className="text-xl text-muted-foreground">Your intelligent tennis platform</p>
        </div>
      </div>
    </div>
  );
};

export default Index;

import HelloWorld from "@/features/test/hello";
import { ModeToggle } from "@/components/mode-toggle";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-4 bg-zinc-50 font-sans dark:bg-black">
      <HelloWorld />
      <ModeToggle />
    </div>
  );
}

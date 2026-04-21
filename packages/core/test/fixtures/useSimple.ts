import { useState } from "react";

export function useSimple() {
  const [count, setCount] = useState(0);
  return { count, setCount };
}

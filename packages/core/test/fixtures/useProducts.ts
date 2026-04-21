export function useProducts() {
  const [data, setData] = useState([]);
  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then(setData);
  }, []);
  return { data };
}

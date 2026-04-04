"""
Router package.

HOW TO ADD AN ENDPOINT:
  1. Create a new file in this directory, e.g., routers/kpis.py
  2. Define a router:
       from fastapi import APIRouter, Depends
       from services.data_loader import get_data
       router = APIRouter()

       @router.get("/kpis")
       def kpis(period: str = "ytd", data: dict = Depends(get_data)):
           df = data["my_table"]
           # ... compute KPIs from DataFrame ...
           return {"revenue": float(df["amount"].sum())}

  3. Register it in main.py:
       from routers import kpis
       app.include_router(kpis.router, prefix="/api")

  4. Add matching frontend hook in lib/api.ts:
       export function useKpis(period: string) {
         return useQuery<KpiResponse>({
           queryKey: ['kpis', period],
           queryFn: () => apiFetch(`/api/kpis?period=${period}`),
         })
       }
"""

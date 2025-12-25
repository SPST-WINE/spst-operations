// app/login/loading.tsx
export default function Loading() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="mx-auto h-11 w-11 rounded-full bg-slate-200" />
          <div className="h-4 w-2/3 mx-auto bg-slate-200 rounded" />
          <div className="h-3 w-1/2 mx-auto bg-slate-200 rounded" />
          <div className="h-9 w-full bg-slate-200 rounded mt-4" />
          <div className="h-9 w-full bg-slate-200 rounded" />
          <div className="h-9 w-full bg-slate-200 rounded" />
        </div>
      </div>
    </div>
  );
}

// COMMENTO DI PROVA

import { memo } from 'react';

const RemoteAccess = memo(() => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4">
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Coming Soon</h1>
    </div>
  );
});

RemoteAccess.displayName = 'RemoteAccess';
export default RemoteAccess;

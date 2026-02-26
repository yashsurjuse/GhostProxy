import Breadcrumb from '../components/player/Breadcrumb';
import Loader from '../components/player/Loader';
import { useLocation, Navigate } from 'react-router-dom';
import { useOptions } from '/src/utils/optionsContext';

const Player = () => {
  const location = useLocation();
  const app = location.state?.app;
  const { options } = useOptions();

  //handling when directly nav to /discover/r/
  if (!app) {
    return <Navigate to="/discover" replace />;
  }

  return (
    <>
      <div className="w-[80%] mx-auto flex flex-col gap-4 mt-4 mb-8">
        <Breadcrumb theme={options.theme} name={app.appName} />
        <Loader theme={options.theme} app={app} />
      </div>
    </>
  );
};

export default Player;

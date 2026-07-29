export const LoginButton = () => (
  <a
    href={`${import.meta.env.VITE_API_BASE_URL}/auth/login`}
    className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-200"
  >
    Log In
  </a>
);

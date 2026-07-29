export const LogoutButton = () => (
  <a
    href={`${import.meta.env.VITE_API_BASE_URL}/auth/logout`}
    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition duration-200"
  >
    Log Out
  </a>
);

/** Where to go once signed in: the page you were sent to sign in from (only pages on this site), else home. */
export const afterLogin = state => {
  const from = state?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && from !== '/login' ? from : '/';
};

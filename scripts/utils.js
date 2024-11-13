export const generateLogFilenameWithTimestamp = (service) => {
  const currentDate = new Date();
  return `${service}-${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDay()}.log`;
};

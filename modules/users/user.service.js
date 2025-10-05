import User from "./user.model.js";

export const findByEmail = async (email) => {
  return await User.findOne({ email });
};

export const create = async (data) => {
  const user = new User(data);
  return await user.save();
};

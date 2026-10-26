const { withGradleProperties } = require("@expo/config-plugins");

module.exports = function withAndroidBuiltInKotlinCompat(config) {
  return withGradleProperties(config, (config) => {
    const property = config.modResults.find(
      (item) =>
        item.type === "property" && item.key === "android.builtInKotlin",
    );

    if (property) {
      property.value = "false";
    } else {
      config.modResults.push({
        type: "property",
        key: "android.builtInKotlin",
        value: "false",
      });
    }

    return config;
  });
};

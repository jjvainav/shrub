For this example, each package has a defined dependency to the @shrub/* packages in their package.json files.
Otherwise there would be an issue with some packages being referenced from the root shrub node_modules and
the node_modules in the 04-workench root causing build errors with TS.
const fs = require("fs").promises;
const path = require("path");
const csv = require("csv-parse");
const { promisify } = require("util");

class Helper {
  static resolvePath(inputPath) {
    return path.normalize(inputPath);
  }

  static async removeFileOrDirectory(pathToRemove) {
    try {
      const stats = await fs.stat(pathToRemove);
      if (stats.isFile()) {
        await fs.unlink(pathToRemove);
      } else {
        await fs.rm(pathToRemove, { recursive: true, force: true });
      }
    } catch (error) {
      throw new Error(
        `Cannot remove file or directory. Path '${pathToRemove}' doesn't exist.`
      );
    }
  }
}

class Repository {
  constructor(dataDir) {
    this.dataDir = Helper.resolvePath(dataDir);
    this.caches = {};
  }

  async readCsv(file, filter = null) {
    const filePath = path.join(this.dataDir, file);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const parsePromise = promisify(csv.parse);
      const rows = await parsePromise(content, { skipEmptyLines: true });

      if (this.caches[file]) {
        return filter ? this.caches[file].filter(filter) : this.caches[file];
      }

      this.caches[file] = rows;
      return filter ? rows.filter(filter) : rows;
    } catch (error) {
      throw new Error(`File '${file}' doesn't exist in data directory.`);
    }
  }

  async mapCsv(file, map, filter = null) {
    const rows = await this.readCsv(file, filter);
    return rows.map((row) => {
      const data = {};
      map.forEach((key, index) => {
        data[key] = row[index] || null;
      });
      return data;
    });
  }

  async getProvinces() {
    return this.mapCsv("provinces.csv", ["id", "name"]);
  }

  async getRegenciesByProvinceId(provinceId) {
    return this.mapCsv(
      "regencies.csv",
      ["id", "province_id", "name"],
      (row) => row[1] === provinceId
    );
  }

  async getDistrictsByRegencyId(regencyId) {
    return this.mapCsv(
      "districts.csv",
      ["id", "regency_id", "name"],
      (row) => row[1] === regencyId
    );
  }

  async getVillagesByDistrictId(districtId) {
    return this.mapCsv(
      "villages.csv",
      ["id", "district_id", "name"],
      (row) => row[1] === districtId
    );
  }
}

class Generator {
  constructor(repository, outputDir) {
    this.repository = repository;
    this.outputDir = Helper.resolvePath(outputDir);
  }

  async clearOutputDir() {
    try {
      const files = await fs.readdir(this.outputDir);
      await Promise.all(
        files.map((file) =>
          Helper.removeFileOrDirectory(path.join(this.outputDir, file))
        )
      );
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(this.outputDir, { recursive: true });
    }
  }

  async makeDirectoriesIfNotExists(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async generateApi(uri, data) {
    const filePath = path.join(this.outputDir, uri);
    await this.makeDirectoriesIfNotExists(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`+ ${uri}`);
  }

  async generate() {
    const provinces = await this.repository.getProvinces();
    await this.generateApi("/provinces.json", provinces);

    for (const province of provinces) {
      const regencies = await this.repository.getRegenciesByProvinceId(
        province.id
      );
      await this.generateApi(`/regencies/${province.id}.json`, regencies);
      await this.generateApi(`/province/${province.id}.json`, province);

      for (const regency of regencies) {
        const districts = await this.repository.getDistrictsByRegencyId(
          regency.id
        );
        await this.generateApi(`/districts/${regency.id}.json`, districts);
        await this.generateApi(`/regency/${regency.id}.json`, regency);

        for (const district of districts) {
          const villages = await this.repository.getVillagesByDistrictId(
            district.id
          );
          await this.generateApi(`/villages/${district.id}.json`, villages);
          await this.generateApi(`/district/${district.id}.json`, district);

          for (const village of villages) {
            await this.generateApi(`/village/${village.id}.json`, village);
          }
        }
      }
    }
  }
}

// Export the classes
module.exports = {
  Helper,
  Repository,
  Generator,
};

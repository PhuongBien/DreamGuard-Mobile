type WardMeta = { code: string; name: string };

type DistrictMeta = {
  code: string;
  name: string;
  wards: WardMeta[];
};

type ProvinceMeta = {
  code: string;
  name: string;
  districts: DistrictMeta[];
};

const ADDRESS_META: ProvinceMeta[] = [
  {
    code: "79",
    name: "TP. Ho Chi Minh",
    districts: [
      {
        code: "760",
        name: "Quan 1",
        wards: [
          { code: "76001", name: "Phuong Ben Nghe" },
          { code: "76002", name: "Phuong Ben Thanh" },
          { code: "76003", name: "Phuong Da Kao" },
          { code: "76004", name: "Phuong Nguyen Thai Binh" },
        ],
      },
      {
        code: "761",
        name: "Quan 3",
        wards: [
          { code: "76101", name: "Phuong Vo Thi Sau" },
          { code: "76102", name: "Phuong 1" },
          { code: "76103", name: "Phuong 2" },
        ],
      },
      {
        code: "762",
        name: "Quan 4",
        wards: [
          { code: "76201", name: "Phuong 1" },
          { code: "76202", name: "Phuong 2" },
          { code: "76203", name: "Phuong 3" },
        ],
      },
      {
        code: "763",
        name: "Quan 5",
        wards: [
          { code: "76301", name: "Phuong 1" },
          { code: "76302", name: "Phuong 2" },
          { code: "76303", name: "Phuong 3" },
        ],
      },
      {
        code: "764",
        name: "Quan 7",
        wards: [
          { code: "76401", name: "Phuong Tan Phu" },
          { code: "76402", name: "Phuong Tan Phong" },
          { code: "76403", name: "Phuong Phu My" },
        ],
      },
      {
        code: "765",
        name: "Quan Binh Thanh",
        wards: [
          { code: "76501", name: "Phuong 1" },
          { code: "76502", name: "Phuong 2" },
          { code: "76503", name: "Phuong 25" },
        ],
      },
      {
        code: "766",
        name: "Thanh pho Thu Duc",
        wards: [
          { code: "76601", name: "Phuong Linh Trung" },
          { code: "76602", name: "Phuong Hiep Binh Chanh" },
          { code: "76603", name: "Phuong Thao Dien" },
        ],
      },
      {
        code: "767",
        name: "Quan Tan Binh",
        wards: [
          { code: "76701", name: "Phuong 2" },
          { code: "76702", name: "Phuong 4" },
          { code: "76703", name: "Phuong 12" },
        ],
      },
      {
        code: "768",
        name: "Quan Phu Nhuan",
        wards: [
          { code: "76801", name: "Phuong 1" },
          { code: "76802", name: "Phuong 2" },
          { code: "76803", name: "Phuong 7" },
        ],
      },
    ],
  },
  {
    code: "01",
    name: "Ha Noi",
    districts: [
      {
        code: "001",
        name: "Ba Dinh",
        wards: [{ code: "00101", name: "Phuong Phuc Xa" }],
      },
    ],
  },
];

const normalizeCode = (value: string, expectedLength: number): string => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length > expectedLength) return "";
  return digits.padStart(expectedLength, "0");
};

const findByWardCode = (wardCode: string) => {
  for (const province of ADDRESS_META) {
    for (const district of province.districts) {
      const ward = district.wards.find((item) => item.code === wardCode);
      if (ward) {
        return { province, district, ward };
      }
    }
  }
  return null;
};

const findByDistrictCode = (districtCode: string) => {
  for (const province of ADDRESS_META) {
    const district = province.districts.find((item) => item.code === districtCode);
    if (district) {
      return { province, district };
    }
  }
  return null;
};

const findByProvinceCode = (provinceCode: string) => {
  return ADDRESS_META.find((item) => item.code === provinceCode) || null;
};

export const formatVietnamAddress = (input?: string | null): string => {
  const raw = String(input ?? "").trim();
  if (!raw) return "";

  const tokens = raw.match(/\d+/g) || [];
  if (!tokens.length) return raw;

  const wardCode =
    normalizeCode(tokens.find((item) => item.length === 5) || "", 5) ||
    normalizeCode(raw, 5);
  const districtCode =
    normalizeCode(tokens.find((item) => item.length === 3) || "", 3) ||
    normalizeCode(raw, 3);
  const provinceCode =
    normalizeCode(tokens.find((item) => item.length <= 2) || "", 2) ||
    normalizeCode(raw, 2);

  let provinceName = "";
  let districtName = "";
  let wardName = "";

  if (wardCode) {
    const wardMatch = findByWardCode(wardCode);
    if (wardMatch) {
      provinceName = wardMatch.province.name;
      districtName = wardMatch.district.name;
      wardName = wardMatch.ward.name;
    }
  }

  if (!districtName && districtCode) {
    const districtMatch = findByDistrictCode(districtCode);
    if (districtMatch) {
      provinceName = districtMatch.province.name;
      districtName = districtMatch.district.name;
    }
  }

  if (!provinceName && provinceCode) {
    const provinceMatch = findByProvinceCode(provinceCode);
    if (provinceMatch) {
      provinceName = provinceMatch.name;
    }
  }

  const namedParts = [wardName, districtName, provinceName].filter(Boolean);
  if (!namedParts.length) return raw;

  const detail = raw
    .split(/[,|;/.-]+/)
    .map((item) => item.trim())
    .filter((item) => item && !/^\d+$/.test(item))
    .join(", ");

  return [detail, namedParts.join(", ")].filter(Boolean).join(", ");
};

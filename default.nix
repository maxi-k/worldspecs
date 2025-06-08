{ pkgs ? import (fetchTarball channel:nixos-25.05) {} }:


with pkgs;
stdenv.mkDerivation {
  pname = "worldspecs";
  version = "0.1.0";
  src = lib.fileset.toSource {
    root = ./.;
    fileset = lib.fileset.gitTracked ./.;
  };

  buildInputs = [
    nodejs_22 # website
    python313 # data converter
    python313Packages.duckdb
    python313Packages.pandas
  ];

  nativeBuildInputs = [
    inkscape
    duckdb
  ];
}

// Cache spatial noise once; the GPU animates its coordinates and lighting.
// Periodic lattice coordinates let the dust drift without a texture seam.
const SIZE = 256;
let pixels: Uint8Array | undefined;

function noise(x: number, y: number, period: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x-ix, fy = y-iy;
  const u = fx*fx*(3-2*fx), v = fy*fy*(3-2*fy);
  const hash = (a: number, b: number) => {
    let n = Math.imul((a+period)%period, 374761393) ^ Math.imul((b+period)%period, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0)/4294967295;
  };
  const a=hash(ix,iy), b=hash(ix+1,iy), c=hash(ix,iy+1), d=hash(ix+1,iy+1);
  return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}

export function createGravityDustTexture(gl: WebGL2RenderingContext) {
  if (!pixels) {
    pixels = new Uint8Array(SIZE*SIZE*4);
    for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) {
      const offset=(y*SIZE+x)*4;
      let cloud=0, weight=.53;
      for (let octave=0;octave<5;octave++) {
        const period=8*2**octave;
        cloud+=noise(x/SIZE*period,y/SIZE*period,period)*weight;
        weight*=.5;
      }
      pixels[offset]=Math.round(cloud*255);
      pixels[offset+1]=Math.round(noise(x/8,y/8,32)*255);
      pixels[offset+2]=Math.round(noise(x/2,y/2,128)*255);
      pixels[offset+3]=255;
    }
  }
  const texture=gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,SIZE,SIZE,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  gl.generateMipmap(gl.TEXTURE_2D);
  return texture;
}

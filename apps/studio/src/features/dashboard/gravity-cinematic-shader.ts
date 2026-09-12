// A perspective disk with an art-directed lens transfer, not a photograph:
// the same orbiting matter feeds the direct, primary and secondary images.
export const GRAVITY_FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 uResolution;
uniform vec2 uViewport;
uniform sampler2D uDust;
uniform float uTime;
uniform vec2 uPointer;
uniform vec2 uCenter;
uniform vec2 uDisk;
uniform float uActiveIndex;
uniform float uStoreCount;
uniform float uSelectionVisible;
uniform float uTemplateSelected;
uniform float uLaunchProgress;
uniform float uMaterialSpeed;
uniform float uStarDensity;
uniform float uDustIntensity;
uniform float uHaloIntensity;
uniform float uWarmth;
uniform float uContrast;
uniform float uDiskLayers;
uniform float uTurbulence;
uniform float uFilamentDetail;
uniform float uGasAbsorption;
uniform float uDiskTilt;
uniform float uLensStrength;
uniform float uBloomSpread;
uniform float uCausticIntensity;
uniform float uGalaxyIntensity;
uniform float uStarTwinkle;
uniform float uVignette;
uniform float uStaticDiskDetails;
uniform float uDustBeltEnabled;
uniform float uProceduralDetailEnabled;
uniform float uDiskWarpEnabled;
uniform float uLensedSecondaryEnabled;
uniform float uCloudEnvelopeEnabled;
uniform float uErosionEnabled;
uniform float uLaneBrightnessEnabled;
uniform float uStreamersEnabled;
uniform float uHotRimEnabled;
uniform float uGasCloudBrightnessEnabled;
uniform float uStreaksEnabled;
uniform float uTemperatureCloudModulationEnabled;
uniform float uDensityEnvelopeEnabled;
uniform float uDensityLaneAbsorptionEnabled;
uniform float uLensedErosionCloudsEnabled;
uniform float uGasCloudStructureEnabled;
uniform float uOrbitalLanePatternEnabled;
uniform float uLensedBreakupEnabled;
uniform float uLensedBaseEmissionEnabled;
uniform float uLensedDensityMaskEnabled;
uniform float uLensedGlowCloudEnabled;
uniform float uBroadWispsEnabled;
uniform float uLensedStaticEnvelopeEnabled;
uniform float uRimCloudModulationEnabled;
uniform float uFarSideDiskEnabled;
uniform float uNearSideDiskEnabled;
uniform float uThermalColorEnabled;
uniform float uRadialHeatEnabled;
uniform float uDepthAbsorptionEnabled;
uniform float uLayerCorrugationEnabled;
uniform vec2 uTaaJitter;
uniform sampler2D uTaaHistory;
uniform float uTaaHistoryWeight;
uniform float uTaaHistoryValid;
const float TAU = 6.28318530718;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
    mix(hash(i + vec2(0,1)), hash(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) {
  float n = .52 * noise(p);
  p = mat2(.8,-.6,.6,.8) * p * 2.03 + 7.1;
  n += .27 * noise(p);
  p = mat2(.8,-.6,.6,.8) * p * 2.07 + 3.7;
  return n + .14 * noise(p) + .07 * noise(p * 2.1);
}
mat2 rotate(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
float band(float x, float width) { return exp(-x*x / (width*width)); }
// Preserve the energy of subpixel light bands as render resolution changes.
float filteredBand(float distance, float width, float footprint) {
  float filteredWidth=sqrt(width*width+footprint*footprint*.25);
  return band(distance,filteredWidth)*width/filteredWidth;
}

// Two overlapping gas populations renew before shear can accumulate aliasing.
// Their velocities always point inward and forward; only their density fades.
vec3 gasPopulation(vec2 orbit, float r, float age, float footprint) {
  float sourceRadius = r + age*.006;
  vec2 flow = rotate(age*.06/pow(max(r,1.0),1.5)) * orbit * sourceRadius/r;
  // Local eddies deform detail without moving the large disk envelope.
  vec2 cell = floor(flow*1.7);
  vec2 local = fract(flow*1.7)-.5;
  float eddy = band(length(local),.38)*(hash(cell)*2.0-1.0);
  flow += (rotate(age*.025*eddy)*local-local)*.12*uTurbulence;
  vec2 direction = flow/sourceRadius;
  float cloud = fbm(flow*3.3 + vec2(sourceRadius*1.4,0));
  float warp = noise(flow*7.0 + cloud*2.0);
  float branches = noise(flow*11.0 + vec2(cloud,-cloud));
  float radial = sourceRadius + (cloud-.5)*.12 + (warp-.5)*.09*uDiskWarpEnabled;
  float thread = noise(vec2(radial*38.0,4.0)+direction*vec2(5.0,9.0));
  float fine = noise(vec2((radial+(branches-.5)*.026)*79.0,17.0)+direction*12.0);
  float segments = smoothstep(.16,.8,noise(flow*vec2(13.0,8.0)));
  // Filter both frequency bands, including the lensed image's compression.
  float threadVisibility=1.0-smoothstep(.35,1.2,footprint*38.0);
  float fineVisibility=1.0-smoothstep(.25,1.0,footprint*79.0);
  // Mix filament energy, not raw noise: averaging before the power erased
  // highlights and dark lanes whenever the two populations overlapped.
  return vec3(cloud,
    mix(.14,pow(thread,2.7),threadVisibility)*(.35+segments*.65)*uProceduralDetailEnabled,
    mix(.07,pow(fine,3.5),fineVisibility)*(.2+branches*.8)*uProceduralDetailEnabled);
}

// RGB is emission; alpha is optical density. Dark gas still absorbs light.
vec4 matter(vec2 orbit, float t, float lensedPass) {
  float r = length(orbit);
  // Derivatives are evaluated before the support branch, even at disk edges.
  // Express the footprint in CSS pixels so adaptive resolution retains detail.
  vec2 direction = orbit/max(r,.001);
  vec2 dx=dFdx(orbit), dy=dFdy(orbit);
  float footprint=(abs(dot(direction,dx))+abs(dot(direction,dy))
    +(length(dx)+length(dy))*.12)*uResolution.y/max(uViewport.y,1.0);
  if (r < 1.05 || r > 5.6) return vec4(0);
  // Smooth spatial offsets prevent the whole disk renewing in synchrony.
  float phase = fract(t/48.0 + direction.x*.09+r*.025);
  float weight = .5-.5*cos(phase*TAU);
  vec3 gas = mix(gasPopulation(orbit,r,fract(phase+.5)*48.0,footprint),
    gasPopulation(orbit,r,phase*48.0,footprint),weight);
  float cloudBase = mix(.5,gas.x,uGasCloudStructureEnabled);
  // A slow envelope retains the large forms while the small filaments flow.
  float staticEnvelope = fbm(rotate(t*.001)*orbit*1.7);
  float staticEnvelopeMix = uStaticDiskDetails * mix(1.0,uLensedStaticEnvelopeEnabled,lensedPass);
  float envelope = mix(cloudBase,staticEnvelope,staticEnvelopeMix);
  float cloud = mix(cloudBase,mix(envelope,cloudBase,.5),uCloudEnvelopeEnabled);
  float erosionGas = mix(cloudBase,0.0,lensedPass*(1.0-uLensedErosionCloudsEnabled));
  float erosionRaw = smoothstep(.22,.72,erosionGas*.65+envelope*.35);
  float erosion = mix(1.0,erosionRaw,uErosionEnabled);
  float lanes=smoothstep(.25,.66,noise(orbit*5.5+vec2(cloudBase*2.0,0)));
  lanes=mix(.5,lanes,uOrbitalLanePatternEnabled);
  float streaks = (gas.y*2.7+gas.z*1.1)*erosion*uFilamentDetail*uStreaksEnabled;
  float broadWisps = mix(.02,(.08+cloud*.22)*(.25+cloud),uGasCloudBrightnessEnabled);
  broadWisps *= uBroadWispsEnabled;
  float laneBrightness = mix(1.0,.5+lanes*.5,uLaneBrightnessEnabled);
  float streakCloud = mix(.25,.25+cloud,uGasCloudBrightnessEnabled);
  float wisps = (broadWisps+streaks*1.1*streakCloud)*laneBrightness;
  float inner = smoothstep(1.05+(cloud-.5)*.035,1.27,r);
  float outer = 1.0 - smoothstep(2.5,5.6,r);
  float streamers = smoothstep(.48,.72,cloud)*gas.y*uStreamersEnabled;
  outer *= mix(.65+erosion*.35,.045+streamers*2.5,smoothstep(3.2,5.4,r));
  float heatFalloff = exp(-(r - 1.2) * .87);
  float heat = mix(1.0,heatFalloff,uRadialHeatEnabled);
  vec3 copper = vec3(.72,.235,.068);
  vec3 cream = vec3(1.0,.80,.55);
  vec3 hot = vec3(1.0,.95,.83);
  vec3 thermalColor = mix(copper,cream,smoothstep(.08,.8,heatFalloff));
  vec3 temperature = mix(vec3(1.0),thermalColor,uThermalColorEnabled);
  temperature = mix(temperature,hot,
    pow(heat,3.0)*(.5+cloud*.3*uTemperatureCloudModulationEnabled)*uThermalColorEnabled);
  float beaming = .8 + .65 * smoothstep(-3.0,2.0,orbit.x);
  float hotRim = band(r-1.26-(cloud-.5)*.09,.055) * (.2+cloud*.8)*uHotRimEnabled;
  vec3 emission = (temperature*wisps+hot*hotRim*.26)*inner*outer*heat*beaming*5.0;
  // Concentrate the extra emission in the inner gas, not the outer halo.
  emission *= 1.0+.2*(1.0-smoothstep(2.0,3.0,r));
  // Dense cool lanes may absorb strongly while emitting very little.
  float depthAbsorption = .18+envelope*.9*uDensityEnvelopeEnabled
    +(1.0-lanes)*.8*uDensityLaneAbsorptionEnabled+erosionRaw*.35*uErosionEnabled;
  float density = inner*outer*mix(.18,depthAbsorption,uDepthAbsorptionEnabled);
  return vec4(emission,density);
}

vec3 stars(vec2 p, float scale, float threshold, float t, float depth, float density) {
  p += vec2(t*.00024,t*.00007)*depth;
  vec2 cell = floor(p * scale);
  vec2 f = fract(p * scale) - .5;
  float h = hash(cell);
  vec2 center = vec2(hash(cell+17.2),hash(cell-8.7)) * .7 - .35;
  vec2 d = f - center;
  float radius = mix(.007,.024,pow(hash(cell+3.2),3.0));
  float pixel=max(fwidth(p.x),fwidth(p.y))*scale;
  float filteredRadius=sqrt(radius*radius+pixel*pixel*.25);
  float core=band(length(d),filteredRadius)*radius*radius/(filteredRadius*filteredRadius);
  float glow=band(length(d),radius*5.0)*.05;
  float shimmer=1.0+.08*sin(t*(.22+h*.3)*uStarTwinkle+hash(cell+9.0)*TAU);
  vec3 tint=mix(vec3(.65,.77,1.0),vec3(1.0,.72,.48),hash(cell+27.0));
  float visible = step(clamp(threshold + (1.0-density)*.18,.68,.999),h);
  return tint*(core*2.0+glow)*visible*shimmer;
}

vec3 sky(vec2 p, float t) {
  // The dust belt cuts diagonally behind the well, leaving the left void dark.
  vec2 n = rotate(.69) * (p - vec2(.35,.05));
  vec2 drift=vec2(t*.00006,-t*.00004);
  vec3 dustSample=texture(uDust,n*vec2(.4,.7)+drift).rgb;
  float cloud=dustSample.r;
  float detail=texture(uDust,n*vec2(1.5,2.2)+drift*.6+.31).r;
  float ribbon = band(n.x + sin(n.y*3.2)*.10, .20);
  float dust = smoothstep(.25,.7,cloud) * ribbon;
  float rifts = smoothstep(.30,.67,detail);
  float grains = dustSample.g*dustSample.b;
  vec3 c = vec3(.0006,.00085,.0013);
  c += mix(vec3(.055,.067,.08), vec3(.17,.085,.042),cloud)
    * dust * (rifts*.7 + grains*.6) * 1.3 * uDustIntensity * uDustBeltEnabled;
  c += stars(p,18.0,.91,t,1.0,uStarDensity)*1.0;
  c += stars(p+3.1,42.0,.96,t,.42,uStarDensity)*.9;
  c += stars(p-1.7,78.0,.978,t,.14,uStarDensity)*.65;
  // A distant inclined spiral galaxy supplies a quiet depth cue on the left.
  vec2 g = rotate(.55) * (p - vec2(-.85,-.18));
  g.x *= 2.4;
  float gr = length(g);
  float ga = atan(g.y,g.x);
  float arms = .5 + .5*cos(ga*2.0 - log(gr+.002)*4.2);
  c += vec3(.25,.12,.055) * exp(-gr*65.0) * (.3+arms*.7)*uGalaxyIntensity;
  return c;
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 screen = ((gl_FragCoord.xy + uTaaJitter) / uResolution - .5) * vec2(aspect,1);
  float seconds = uTime * .001;
  float launch = smoothstep(0.0,1.0,uLaunchProgress);
  // Start bending the disk earlier so the approach shows the distortion longer
  // while the smoothstep keeps the first movement gradual.
  float plunge=smoothstep(.12,.97,launch);
  vec2 center = mix(uCenter,vec2(0),launch);
  float zoom = mix(1.0,.12,launch) * mix(1.0,.54,plunge*plunge);
  // Make Gargantua itself grow 120% during the approach. Finish the scale-up
  // before the final blackout so the change remains visible to the user.
  float gargantuaScale=1.0+1.20*smoothstep(.18,.72,launch);
  float radius = uDisk.x * .48 * gargantuaScale;
  // Pointer translation supplies parallax without changing the disk's tilt.
  vec2 q = rotate(.16) * (screen-center) * zoom / radius;
  float radial = length(q);
  // +300% = four times the prior material clock. Launch only changes camera
  // position; multiplying accumulated time by launch caused phase jumps.
  float t = seconds * 4.0 * uMaterialSpeed;
  // Keep the visible slider range intact: this is the internal base strength.
  // A bounded response prevents the stronger base from flipping the background
  // while the falloff concentrates the extra bend around the black hole.
  float launchLens=smoothstep(.16,.94,launch);
  float launchLensBoost=1.0+7.0*launchLens*launchLens;
  float horizonProximity=1.0-smoothstep(.78,2.55+launchLens*1.15,radial);
  float lensArgument=.038*50.0*uLensStrength
    *launchLensBoost*pow(horizonProximity,mix(1.65,1.08,launchLens))/(radial*radial+.5);
  float deflection=lensArgument/(1.0+lensArgument);
  vec2 bent=q*(1.0-deflection);
  vec2 skyPoint=center+rotate(-.16)*bent*radius/zoom;
  vec3 background = sky(skyPoint,seconds * uMaterialSpeed);
  vec3 color = background;

  // During the plunge the disk is magnified radially, then sheared along the
  // local tangent. This folds its bright bands around the horizon while the
  // central shadow keeps using the undistorted q/radial silhouette.
  vec2 radialDirection=q/max(radial,.001);
  vec2 tangent=vec2(-radialDirection.y,radialDirection.x);
  float plungeShear=.62*plunge*plunge*horizonProximity*horizonProximity
    *clamp(q.x,-1.35,1.35);
  vec2 diskQ=mix(q,bent,launchLens*.88)-tangent*plungeShear;

  // Rays meet a genuinely inclined disk in 3D. Several parallel slices give
  // the optically thin gas thickness without a costly full-screen ray march.
  float inclination = .15*uDiskTilt;
  vec3 eye = vec3(0.0, inclination*18.0,18.0);
  vec3 forward = normalize(-eye);
  vec3 right = vec3(1,0,0);
  vec3 up = normalize(cross(right,forward));
  vec3 ray = normalize(forward * 18.0 + right*diskQ.x + up*diskQ.y);
  vec3 behind = vec3(0), front = vec3(0);
  float frontTransmission = 1.0;
  vec2 directOrbit=vec2(0);
  for(int layer=0; layer<6; layer++) {
    if (float(layer) >= uDiskLayers) continue;
    float activeLayerCount = clamp(uDiskLayers,1.0,6.0);
    float slice = activeLayerCount <= 3.0
      ? float(layer)-1.0
      : float(layer)-(activeLayerCount-1.0)*.5;
    float altitude = slice*.023;
    float depth = (altitude-eye.y) / min(ray.y,-.00001);
    vec3 hit = eye + ray*depth;
    // Corrugated sheets approximate a varying gas thickness with bounded cost.
    float corrugation = (noise(hit.xz*2.3+vec2(t*.006,0))-.5)*(.012+abs(slice)*.009)
      * uDiskWarpEnabled*uLayerCorrugationEnabled;
    depth = (altitude+corrugation-eye.y)/min(ray.y,-.00001);
    hit = eye+ray*depth;
    vec2 orbit = hit.xz;
    bool centralLayer = abs(slice) < .25;
    if (layer == 1 || (uDiskLayers > 3.0 && layer == int(floor(uDiskLayers*.5)))
      || (uDiskLayers < 2.0 && layer == 0)) directOrbit=orbit;
    float density = (centralLayer && uDiskLayers >= 2.0) ? .72 : .14;
    vec4 gas = matter(orbit,t,0.0);
    float nearSide = smoothstep(-.1,.1,hit.z);
    float pathLength=clamp(.15/max(abs(ray.y),.045),.6,3.0);
    float tau=gas.a*density*pathLength*3.4*uGasAbsorption;
    float nearTrans=exp(-tau*nearSide);
    float farTrans=exp(-tau*(1.0-nearSide));
    vec3 source=gas.rgb/(gas.a+.25);
    // Low-to-high slices are far-to-near for this camera above the plane.
    front=front*nearTrans+source*(1.0-nearTrans);
    behind=behind*farTrans+source*(1.0-farTrans);
    frontTransmission*=nearTrans;
  }
  color += behind*uFarSideDiskEnabled;

  // The far-side disk has a second image folded over the shadow. Its radius
  // maps back to the same material as the direct disk, so both shear together.
  float upper = smoothstep(-.15,.2,diskQ.y);
  float arcRadius = mix(1.0,1.025,upper);
  // Flare the far image tangentially into the disk instead of terminating
  // a circular hoop vertically at either side of the shadow.
  float flare = exp(-abs(diskQ.y)*2.0)/(abs(diskQ.y)+.18)*mix(.025,.105,upper);
  // Pull the upper image toward the inner disk lip as it approaches the
  // plane; the old lateral flare landed too far out on the disk surface.
  flare *= mix(1.0,mix(.18,1.0,smoothstep(.08,.65,abs(diskQ.y))),upper);
  vec2 lensPoint = vec2(diskQ.x/(1.0+flare),diskQ.y);
  float lensRadius = length(lensPoint);
  float arcDistance = lensRadius-arcRadius;
  float distanceFromArc=max(arcDistance,0.0);
  float lensedRadius = 1.05 + distanceFromArc*3.3+distanceFromArc*distanceFromArc*2.2;
  vec2 arcDirection = lensPoint / max(lensRadius,.001);
  // Far-side emission has negative disk Z. The secondary image reverses parity.
  // Parity is discrete, not a coordinate interpolation through zero width.
  float parity=diskQ.y >= 0.0 ? 1.0 : -1.0;
  vec2 lensedOrbit = vec2(parity*arcDirection.x,
    -abs(arcDirection.y)) * lensedRadius;
  // A tangent transition has no outer cutoff to fold the filaments back.
  // Interpolate radius and direction separately: Cartesian blending shortened
  // orbits at the junction and created the visible compressed zigzag bands.
  float junction=band(diskQ.y,.34)*smoothstep(.88,1.12,abs(diskQ.x));
  vec2 farOrbit=vec2(directOrbit.x,-abs(directOrbit.y));
  float farRadius=max(length(farOrbit),.001);
  float orbitBlend=junction*upper;
  vec2 mergedDirection=normalize(mix(lensedOrbit/lensedRadius,farOrbit/farRadius,orbitBlend));
  float mergedRadius=exp(mix(log(lensedRadius),log(farRadius),orbitBlend));
  lensedOrbit=mergedDirection*mergedRadius;
  // The orbital merge must never bypass the lensed silhouette. Fade only
  // outward from its edge; only the separately composited near disk crosses it.
  float arcVisibility = smoothstep(0.0,.075,arcDistance);
  // The direct image takes over at the plane instead of adding the same gas twice.
  float merge = smoothstep(.0,.20,abs(arcDirection.y))*(1.0-junction*.85);
  vec4 lensedGas = matter(lensedOrbit,t,1.0);
  vec3 lensed = lensedGas.rgb * arcVisibility * merge * uLensedBaseEmissionEnabled;
  float lowerLanes=smoothstep(.25,.75,noise(lensedOrbit*vec2(6.0,2.0)+vec2(t*.012,0)));
  float lensedDensityMask = mix(1.0,smoothstep(.15,.8,lensedGas.a),uLensedDensityMaskEnabled);
  float lowerBreakup = mix(1.0,mix(.24,.95,lowerLanes),uLensedBreakupEnabled)
    *lensedDensityMask;
  color += lensed * mix(lowerBreakup,3.6,upper) * uLensedSecondaryEnabled;
  // Low-frequency emission controls the local halo, not individual hot pixels.
  float glowCloud=mix(.5,texture(uDust,lensedOrbit*.06+vec2(t*.0002,0)).r,uLensedGlowCloudEnabled);
  float glowEnergy=exp(-max(lensedRadius-1.2,0.0)*.8)*(.35+glowCloud*.9);
  float bloomWidth = (.24+glowEnergy*.04)*uBloomSpread;
  color += vec3(1.0,.78,.48) * band(lensRadius-1.12,bloomWidth)
    * mix(.18,.55,upper)*merge*min(glowEnergy,1.6)*arcVisibility*uHaloIntensity
    * uLensedSecondaryEnabled;
  // Broad exterior scattering is separate from filament exposure. Keep it
  // above the disk and under the shadow/front masks to protect the junctions.
  float exteriorHalo=band(radial-1.35,.75*uBloomSpread)*smoothstep(1.02,1.25,radial)
    *smoothstep(.05,.42,q.y);
  color+=vec3(1.0,.86,.73)*exteriorHalo*.28*uHaloIntensity;

  // The shadow is geometrically stable; only its surrounding light moves.
  // One pixel of coverage replaces the old broad, resolution-dependent rim.
  float edge=max(length(vec2(dFdx(radial),dFdy(radial))),.0001);
  float shadowDistance=radial-1.0;
  float outside=smoothstep(-edge*.5,edge*.5,shadowDistance);
  vec2 criticalDirection=q/max(radial,.001);
  float angularCloud=mix(.5,noise(rotate(t*.037)*criticalDirection*7.0),uRimCloudModulationEnabled);
  // The final reference is a single continuous ivory line, not broken bands.
  float illumination=mix(.72,1.0,upper)*(.96+angularCloud*.08);
  vec3 criticalTint=vec3(1.0,.92,.84);
  float primary=filteredBand(shadowDistance-.004,.0025,edge);
  color+=criticalTint*illumination*primary*1.1;
  // Mask all rear emission and scattering together. Near gas is added after
  // occultation, preserving its real passage across the lower silhouette.
  color *= outside;
  // Optical bloom may soften a few pixels inward; geometry stays occulted.
  // Its short falloff leaves the center black and the near disk in front.
  float rimBloom=band(shadowDistance-.004,.022)*.14
    +band(shadowDistance-.004,.065)*.03;
  color+=criticalTint*illumination*rimBloom*uHaloIntensity;
  float nearTransmission = mix(1.0,frontTransmission,uNearSideDiskEnabled);
  color = color * nearTransmission + front*vec3(1.0,.97,.91)*1.25*uNearSideDiskEnabled;

  // Bloom is analytical and local to the caustics, keeping the empty space black.
  float causticY = q.y + .23 + .014*q.x*q.x;
  float caustic = band(causticY,.018) * exp(-abs(q.x)*.9);
  float contact = band(radial-1.01,.015)*band(causticY,.035);
  float frontEnergy = min(dot(front,vec3(.2126,.7152,.0722)),1.5);
  color += vec3(1.0,.76,.47) * (caustic*.12 + contact*.35)*frontEnergy*uHaloIntensity*uCausticIntensity;

  // A selected store only modulates a tiny outer ember, never the shadow.
  float selection = uSelectionVisible*(1.0-uTemplateSelected)*step(.5,uStoreCount);
  float phase = uActiveIndex/max(uStoreCount,1.0)*TAU + t*.035;
  vec2 ember = vec2(cos(phase)*3.5,sin(phase)*.52);
  color += vec3(.6,.31,.12)*band(length(q-ember),.015)*selection*.2;
  float warmthShift = clamp(uWarmth - 1.0,-1.0,1.0);
  vec3 cooler = color*vec3(.88,.96,1.1);
  vec3 warmer = color*vec3(1.08,.92,.72);
  color = warmthShift < 0.0
    ? mix(color,cooler,-warmthShift)
    : mix(color,warmer,warmthShift);
  float edgeDistance = length(screen/vec2(aspect,1.0));
  float vignetteMask = smoothstep(.24,.72,edgeDistance);
  color *= 1.0-vignetteMask*(uVignette-1.0)*.3;
  // Exposure plus display transfer preserves warm highlights and dark dust detail.
  // Luminance compression retains warm chroma in the brightest filaments.
  color=max(color,vec3(0));
  float luminance=dot(color,vec3(.2126,.7152,.0722));
  vec3 mapped=color/(1.0+luminance*.25);
  mapped=1.0-exp(-mapped*2.1);
  mapped = pow(mapped,vec3(.86));
  mapped = clamp((mapped-.5)*uContrast+.5,0.0,1.0);
  mapped *= 1.0 - smoothstep(.86,1.0,launch)*.85;
  if (uTaaHistoryValid > 0.5) {
    vec3 history = texture(uTaaHistory, gl_FragCoord.xy / uResolution).rgb;
    mapped = mix(mapped, history, uTaaHistoryWeight);
  }
  fragColor = vec4(mapped,1);
}
`;

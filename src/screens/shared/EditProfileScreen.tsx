import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { ExperienceItem, ProfileVideo } from '../../types';
import PositionPicker from '../../components/PositionPicker';
import SkillPicker from '../../components/SkillPicker';
import ExperienceDurationPicker from '../../components/experience-duration-picker';
import ProfileVideoCard from '../../components/ProfileVideoCard';
import { COLORS, TAB_BAR_HEIGHT } from '../../constants';
import { INPUT_LIMITS } from '../../constants/inputLimits';
import { useCopilot } from 'react-native-copilot';
import { completeProfileTutorial } from '../../utils/tutorial-flow';
import { profileVideoService } from '../../services/profileVideoService';

type FieldProps = TextInputProps & {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

const ALLOWED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_AVATAR_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

const getFileExtension = (uri: string) => {
  const cleanUri = uri.split('?')[0].split('#')[0];
  return cleanUri.split('.').pop()?.toLowerCase() || '';
};

const extensionFromMimeType = (mimeType?: string | null) => {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/jpeg') return 'jpg';
  return '';
};

const mimeTypeFromExtension = (extension: string) => {
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  return '';
};

function Field({ icon, label, multiline, style, ...props }: FieldProps) {
  const currentLength = typeof props.value === 'string' ? props.value.length : 0;

  return (
    <View style={styles.fieldWrap}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {!!props.maxLength && <Text style={styles.charCounter}>{currentLength}/{props.maxLength}</Text>}
      </View>
      <View style={[styles.field, multiline && styles.fieldMultiline]}>
        <Ionicons name={icon} size={18} color={COLORS.lightGray} style={styles.fieldIcon} />
        <TextInput
          {...props}
          multiline={multiline}
          placeholderTextColor={COLORS.lightGray}
          style={[styles.input, multiline && styles.inputMultiline, style]}
        />
      </View>
    </View>
  );
}

function SectionCard({
  eyebrow,
  title,
  subtitle,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={21} color={COLORS.primarySoft} />
        </View>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export default function EditProfileScreen({ navigation, route }: any) {
  const { user, profile, refreshProfile } = useAuth();
  const { stop } = useCopilot();
  const insets = useSafeAreaInsets();
  const isCompany = profile?.user_type === 'company';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [profileVideos, setProfileVideos] = useState<ProfileVideo[]>([]);
  const [skills, setSkills] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [website, setWebsite] = useState('');
  const [expCompany, setExpCompany] = useState('');
  const [expPosition, setExpPosition] = useState('');
  const [expDuration, setExpDuration] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [experienceItems, setExperienceItems] = useState<ExperienceItem[]>([]);
  const [showExperienceForm, setShowExperienceForm] = useState(false);
  const [editTutorialVisible, setEditTutorialVisible] = useState(route?.params?.tutorial === true);
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(true);

  const finishEditTutorial = () => {
    setEditTutorialVisible(false);
    completeProfileTutorial();
    void stop();
  };

  const skillItems = useMemo(
    () => skills.split(',').map((skill) => skill.trim()).filter(Boolean),
    [skills]
  );

  const fetchData = async () => {
    if (!user || !profile) return;
    setLoading(true);

    setFullName(profile.full_name || '');
    setLocation(profile.location || '');
    setBio(profile.bio || '');
    setAvatarUrl(profile.avatar_url || null);
    setDailyDigestEnabled(profile.daily_match_digest_enabled !== false);

    const [{ data }, videos] = await Promise.all([
      supabase
        .from(isCompany ? 'company_profiles' : 'candidate_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(),
      isCompany ? Promise.resolve([]) : profileVideoService.fetchProfileVideos(user.id).catch(() => []),
    ]);

    setProfileVideos(videos);

    if (isCompany) {
      setCompanyName(data?.company_name || '');
      setIndustry(data?.industry || '');
      setCompanySize(data?.company_size || '');
      setWebsite(data?.website || '');
    } else {
      setSkills((data?.skills || []).join(', '));
      setExperienceItems(data?.experience_items || []);
    }

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [user?.id, profile?.user_type])
  );

  const resetExperienceDraft = () => {
    setExpCompany('');
    setExpPosition('');
    setExpDuration('');
    setExpDescription('');
    setShowExperienceForm(false);
  };

  const addExperience = () => {
    if (!expCompany.trim() || !expPosition.trim() || !expDuration.trim()) {
      Alert.alert('Nedostaju podaci', 'Unesi firmu, poziciju i trajanje iskustva.');
      return;
    }

    setExperienceItems((items) => [
      ...items,
      {
        company: expCompany.trim(),
        position: expPosition.trim(),
        duration: expDuration.trim(),
        description: expDescription.trim(),
      },
    ]);
    resetExperienceDraft();
  };

  const removeExperience = (index: number) => {
    setExperienceItems((items) => items.filter((_, itemIndex) => itemIndex !== index));
  };

  const pickAndUploadImage = async () => {
    if (!user) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Pristup slikama', 'Dozvoli pristup galeriji da bi izabrao/la profilnu sliku.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    try {
      setUploadingImage(true);
      const image = result.assets[0];
      const fileMimeType = image.mimeType || null;
      const fileExt = getFileExtension(image.fileName || image.uri) || extensionFromMimeType(fileMimeType);
      const uploadMimeType = fileMimeType || mimeTypeFromExtension(fileExt);
      if (!ALLOWED_AVATAR_EXTENSIONS.includes(fileExt) || !ALLOWED_AVATAR_MIME_TYPES.includes(uploadMimeType)) {
        throw new Error('Profilna fotografija mora biti JPG, PNG ili WEBP slika.');
      }
      const response = await fetch(image.uri);
      if (!response.ok) throw new Error('Slika nije mogla da se procita.');
      const blob = await response.blob();
      if (blob.type && !ALLOWED_AVATAR_MIME_TYPES.includes(blob.type)) {
        throw new Error('Profilna fotografija mora biti slika.');
      }
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage.from('avatars').upload(filePath, blob, {
        upsert: true,
        contentType: uploadMimeType,
      });
      if (error) throw error;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);
    } catch (error: any) {
      Alert.alert('Upload nije uspeo', error?.message || 'Slika nije uploadovana.');
    } finally {
      setUploadingImage(false);
    }
  };

  const pickAndUploadVideo = async () => {
    if (!user) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Pristup galeriji', 'Dozvoli pristup galeriji da bi izabrao/la video.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
      videoMaxDuration: 60,
    });
    if (result.canceled) return;

    try {
      setUploadingVideo(true);
      const video = result.assets[0];
      const fileName = video.fileName || `profile-video-${Date.now()}.mp4`;
      const mimeType = video.mimeType || 'video/mp4';
      const fileSize = video.fileSize || 0;

      if (!profileVideoService.allowedVideoTypes.includes(mimeType)) {
        throw new Error('Video mora biti MP4, MOV ili WEBM.');
      }
      if (!fileSize || fileSize > profileVideoService.maxVideoSize) {
        throw new Error('Video može imati najviše 100 MB.');
      }
      if (video.duration && video.duration > 60000) {
        throw new Error('Video može trajati najviše 60 sekundi.');
      }

      const upload = await profileVideoService.createUpload({ fileName, mimeType, fileSize });
      const response = await fetch(video.uri);
      if (!response.ok) throw new Error('Video nije mogao da se pročita.');
      const blob = await response.blob();

      const uploadResponse = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });
      if (!uploadResponse.ok) {
        throw new Error('Upload videa na S3 nije uspeo.');
      }

      const savedVideo = await profileVideoService.saveMetadata({
        userId: user.id,
        s3Key: upload.key,
        fileName,
        mimeType,
        fileSize,
        durationMs: video.duration || null,
      });
      setProfileVideos((current) => [savedVideo, ...current]);
    } catch (error: any) {
      Alert.alert('Video nije dodat', error?.message || 'Pokušaj ponovo.');
    } finally {
      setUploadingVideo(false);
    }
  };

  const removeProfileVideo = async (videoId: string) => {
    try {
      await profileVideoService.deleteVideo(videoId);
      setProfileVideos((current) => current.filter((item) => item.id !== videoId));
    } catch (error: any) {
      Alert.alert('Video nije obrisan', error?.message || 'Pokušaj ponovo.');
    }
  };

  const saveProfile = async () => {
    if (!user || !profile) return;
    if (!location.trim()) {
      Alert.alert('Nedostaje lokacija', 'Lokacija je obavezna.');
      return;
    }
    if (!isCompany && !fullName.trim()) {
      Alert.alert('Nedostaje ime', 'Ime i prezime je obavezno.');
      return;
    }
    if (isCompany && !companyName.trim()) {
      Alert.alert('Nedostaje naziv', 'Naziv firme je obavezan.');
      return;
    }

    try {
      setSaving(true);
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || profile.full_name,
          location: location.trim(),
          bio: bio.trim(),
          avatar_url: avatarUrl,
          daily_match_digest_enabled: dailyDigestEnabled,
        })
        .eq('id', user.id);
      if (profileError) throw profileError;

      const detailsUpdate = isCompany
        ? {
            company_name: companyName.trim(),
            industry: industry.trim(),
            company_size: companySize.trim(),
            website: website.trim(),
          }
        : {
            position: null,
            skills: skillItems,
            experience_items: experienceItems,
          };

      const { error: detailsError } = await supabase
        .from(isCompany ? 'company_profiles' : 'candidate_profiles')
        .update(detailsUpdate)
        .eq('id', user.id);
      if (detailsError) throw detailsError;

      await refreshProfile();
      Alert.alert('Sačuvano', 'Profil je uspešno izmenjen.');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Čuvanje nije uspelo', error?.message || 'Pokušaj ponovo.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primarySoft} />
        <Text style={styles.loadingText}>Pripremamo tvoj profil...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.inner}
      >
      <View style={styles.pageInner}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.78} style={styles.backButton}>
            <Ionicons name="arrow-back" size={19} color={COLORS.textSoft} />
          </TouchableOpacity>
          <View style={styles.topBarCopy}>
            <Text style={styles.pageEyebrow}>TVOJ JAVNI PROFIL</Text>
            <Text style={styles.pageTitle}>Uredi profil</Text>
          </View>
          <View style={styles.topBarSpacer} />
        </View>

        <LinearGradient colors={['#21184B', '#13182A', '#0D1019']} style={styles.profileHero}>
          <View style={styles.heroGlow} />
          <LinearGradient colors={[COLORS.primary, COLORS.accent]} style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name={isCompany ? 'business' : 'person'} size={48} color={COLORS.primarySoft} />
              )}
            </View>
          </LinearGradient>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{isCompany ? companyName || 'Tvoja firma' : fullName || 'Tvoj profil'}</Text>
            <Text style={styles.heroSubtitle}>Dobra prica pocinje jasnim i urednim profilom.</Text>
            <TouchableOpacity onPress={pickAndUploadImage} disabled={uploadingImage} activeOpacity={0.82} style={styles.photoButton}>
              {uploadingImage ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Ionicons name="camera" size={17} color={COLORS.white} />
              )}
              <Text style={styles.photoButtonText}>{uploadingImage ? 'Upload...' : 'Promeni fotografiju'}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {!isCompany && (
          <SectionCard
            eyebrow="VIDEO"
            title="Video predstavljanje"
            subtitle="Dodaj kratak video do 60 sekundi. Video se čuva privatno na S3 i prikazuje se firmama dok gledaju kandidate."
            icon="videocam-outline"
          >
            <TouchableOpacity onPress={pickAndUploadVideo} disabled={uploadingVideo} activeOpacity={0.84} style={styles.videoUploadButton}>
              <View style={styles.videoUploadIcon}>
                {uploadingVideo ? (
                  <ActivityIndicator size="small" color={COLORS.primarySoft} />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={22} color={COLORS.primarySoft} />
                )}
              </View>
              <View style={styles.videoUploadCopy}>
                <Text style={styles.videoUploadTitle}>{uploadingVideo ? 'Upload videa...' : 'Dodaj video'}</Text>
                <Text style={styles.videoUploadText}>MP4, MOV ili WEBM. Maksimalno 100 MB i 60 sekundi.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.lightGray} />
            </TouchableOpacity>

            {profileVideos.length ? (
              <View style={styles.videoList}>
                {profileVideos.map((video) => (
                  <ProfileVideoCard key={video.id} video={video} canDelete onDelete={removeProfileVideo} />
                ))}
              </View>
            ) : (
              <Text style={styles.fieldHint}>Još nema dodatog videa. Kratak video pomaže firmi da te bolje upozna pre meča.</Text>
            )}
          </SectionCard>
        )}

        <SectionCard
          eyebrow="01 / OSNOVNO"
          title="Licni podaci"
          subtitle="Ovo je prvi utisak koji drugi vide."
          icon="person-circle-outline"
        >
          {!isCompany && (
            <Field icon="person-outline" label="Ime i prezime" placeholder="Ime i prezime" value={fullName} onChangeText={setFullName} maxLength={INPUT_LIMITS.fullName} />
          )}
          <Field icon="location-outline" label="Lokacija" placeholder="Grad, opstina ili adresa" value={location} onChangeText={setLocation} maxLength={INPUT_LIMITS.location} />
          <Field
            icon="document-text-outline"
            label={isCompany ? 'Opis firme' : 'O meni'}
                placeholder={isCompany ? 'U nekoliko rečenica opiši tim i kulturu...' : 'Šta te pokreće i kakvu priliku tražiš?'}
            value={bio}
            onChangeText={setBio}
            maxLength={INPUT_LIMITS.bio}
            multiline
          />
        </SectionCard>

        <SectionCard
          eyebrow="EMAIL"
                      title="Dnevni izveštaj"
          subtitle="Push ostaje za svaki match, a email možeš da dobijes jednom dnevno."
          icon="mail-outline"
        >
          <View style={styles.digestRow}>
            <View style={styles.digestIcon}>
              <Ionicons name="stats-chart-outline" size={20} color={COLORS.primarySoft} />
            </View>
            <View style={styles.digestCopy}>
              <Text style={styles.digestTitle}>Dnevni email u 22:00</Text>
              <Text style={styles.digestText}>
                {dailyDigestEnabled
                        ? 'Uključeno: dobićeš pregled mečeva iz tog dana.'
                        : 'Isključeno: nećeš dobijati dnevni email izveštaj.'}
              </Text>
            </View>
            <Switch
              value={dailyDigestEnabled}
              onValueChange={setDailyDigestEnabled}
              trackColor={{ false: 'rgba(255,255,255,0.16)', true: 'rgba(124,92,255,0.55)' }}
              thumbColor={dailyDigestEnabled ? COLORS.primarySoft : COLORS.lightGray}
            />
          </View>
          <Text style={styles.fieldHint}>Ovo ne gasi push notifikacije za nove matcheve.</Text>
        </SectionCard>

        {isCompany ? (
          <SectionCard
            eyebrow="02 / KOMPANIJA"
            title="Podaci firme"
            subtitle="Pomogni kandidatima da brzo upoznaju kompaniju."
            icon="business-outline"
          >
            <Field icon="business-outline" label="Naziv firme" placeholder="Naziv firme" value={companyName} onChangeText={setCompanyName} maxLength={INPUT_LIMITS.companyName} />
            <Field icon="layers-outline" label="Industrija" placeholder="IT, ugostiteljstvo, prodaja..." value={industry} onChangeText={setIndustry} maxLength={INPUT_LIMITS.industry} />
              <Field icon="people-outline" label="Veličina tima" placeholder="npr. 1-10, 11-50, 50+" value={companySize} onChangeText={setCompanySize} maxLength={INPUT_LIMITS.companySize} />
            <Field icon="globe-outline" label="Website" placeholder="https://firma.rs" value={website} onChangeText={setWebsite} maxLength={INPUT_LIMITS.website} autoCapitalize="none" />
          </SectionCard>
        ) : (
          <>
            <SectionCard
              eyebrow="02 / KARIJERA"
              title="Šta tražiš?"
              subtitle="Fokusiraj profil na uloge i veštine koje su ti najvažnije."
              icon="compass-outline"
            >
              <SkillPicker
                label="Veštine"
                placeholder="Izaberi veštine koje najbolje opisuju tvoj rad"
                value={skillItems}
                onChange={(items) => setSkills(items.join(', '))}
              />
              {!!skillItems.length && (
                <View style={styles.skillPreview}>
                  {skillItems.map((skill, index) => (
                    <View key={`${skill}-${index}`} style={styles.skillChip}>
                      <Text style={styles.skillChipText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.fieldHint}>Veštine sada biraš iz menija, da poklapanje sa oglasima bude preciznije.</Text>
            </SectionCard>

            <SectionCard
              eyebrow="03 / ISKUSTVO"
              title="Tvoj put do sada"
              subtitle="Dodaj samo iskustva koja najbolje predstavljaju tvoj rad."
              icon="briefcase-outline"
            >
              <View style={styles.experienceList}>
                {experienceItems.map((item, index) => (
                  <View key={index} style={styles.experienceCard}>
                    <View style={styles.experienceMarker} />
                    <View style={styles.experienceCopy}>
                      <Text style={styles.experiencePosition}>{item.position}</Text>
                      {!!item.company && <Text style={styles.experienceCompany}>{item.company}</Text>}
                      <Text style={styles.experienceDuration}>{item.duration}</Text>
                      {!!item.description && <Text style={styles.experienceDescription}>{item.description}</Text>}
                    </View>
                    <TouchableOpacity onPress={() => removeExperience(index)} style={styles.removeButton}>
                      <Ionicons name="trash-outline" size={18} color={COLORS.secondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {!showExperienceForm ? (
                <TouchableOpacity onPress={() => setShowExperienceForm(true)} activeOpacity={0.82} style={styles.addExperienceButton}>
                  <View style={styles.addExperienceIcon}>
                    <Ionicons name="add" size={21} color={COLORS.primarySoft} />
                  </View>
                  <View style={styles.addExperienceCopy}>
                    <Text style={styles.addExperienceTitle}>Dodaj iskustvo</Text>
                    <Text style={styles.addExperienceText}>Otvori kratku formu samo kada ti je potrebna.</Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color={COLORS.lightGray} />
                </TouchableOpacity>
              ) : (
                <View style={styles.experienceForm}>
                  <View style={styles.experienceFormHeader}>
                    <View>
                      <Text style={styles.experienceFormTitle}>Novo iskustvo</Text>
                      <Text style={styles.experienceFormSubtitle}>Tri kratka podatka su dovoljna za pocetak.</Text>
                    </View>
                    <TouchableOpacity onPress={resetExperienceDraft} style={styles.closeFormButton}>
                      <Ionicons name="close" size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <Field icon="business-outline" label="Firma" placeholder="Gde si radio/la?" value={expCompany} onChangeText={setExpCompany} maxLength={INPUT_LIMITS.experienceCompany} />
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>Pozicija</Text>
                    <PositionPicker placeholder="Izaberi poziciju" value={expPosition} onChange={setExpPosition} maxLength={INPUT_LIMITS.position} />
                  </View>
                  <ExperienceDurationPicker value={expDuration} onChange={setExpDuration} />
                  <Field icon="document-text-outline" label="Kratak opis" placeholder="Najvaznije odgovornosti i rezultat..." value={expDescription} onChangeText={setExpDescription} maxLength={INPUT_LIMITS.experienceDescription} multiline />
                  <TouchableOpacity onPress={addExperience} activeOpacity={0.85} style={styles.confirmExperienceButton}>
                    <Ionicons name="checkmark" size={19} color={COLORS.white} />
                    <Text style={styles.confirmExperienceText}>Dodaj u profil</Text>
                  </TouchableOpacity>
                </View>
              )}
            </SectionCard>
          </>
        )}

        <View style={styles.saveDock}>
          <View style={styles.saveCopy}>
            <Text style={styles.saveTitle}>Sve spremno?</Text>
            <Text style={styles.saveSubtitle}>Promene ce odmah biti vidljive na profilu.</Text>
          </View>
          <TouchableOpacity onPress={saveProfile} disabled={saving} activeOpacity={0.86} style={styles.saveTouch}>
            <LinearGradient colors={[COLORS.primary, '#9B6DFF']} style={styles.saveButton}>
              {saving ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />}
                <Text style={styles.saveButtonText}>{saving ? 'Čuvanje...' : 'Sačuvaj izmene'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
      </ScrollView>
      {editTutorialVisible && (
        <View
          style={[
            styles.editTutorialLayer,
            { paddingBottom: TAB_BAR_HEIGHT + Math.max(insets.bottom, 14) },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.editTutorialCard}>
            <View style={styles.editTutorialTop}>
              <View style={styles.editTutorialIcon}>
                <Ionicons name="create-outline" size={22} color={COLORS.primarySoft} />
              </View>
              <Text style={styles.editTutorialCounter}>ZAVRŠNI KORAK</Text>
            </View>
            <Text style={styles.editTutorialTitle}>Ovde uređuješ svoj profil</Text>
            <Text style={styles.editTutorialText}>
              {isCompany
                ? 'Dopuni osnovne podatke, opis, industriju, veličinu tima i sajt firme. Fotografiju menjaš na vrhu, a sve potvrđuješ dugmetom „Sačuvaj izmene“ na dnu.'
                : 'Dopuni osnovne podatke i veštine, pa ispod dodaj iskustva koja najbolje predstavljaju tvoj rad. Sve potvrđuješ dugmetom „Sačuvaj izmene“ na dnu.'}
            </Text>
            <Text style={styles.editTutorialHint}>Forma ostaje potpuno vidljiva i možeš da je skroluješ dok čitaš ovo objašnjenje.</Text>
            <TouchableOpacity style={styles.editTutorialButton} onPress={finishEditTutorial}>
              <Text style={styles.editTutorialButtonText}>Razumem, završi tutorijal</Text>
              <Ionicons name="checkmark" size={19} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.dark },
  container: { flex: 1, backgroundColor: COLORS.dark },
  editTutorialLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, justifyContent: 'flex-end', paddingHorizontal: 16 },
  editTutorialCard: { width: '100%', maxWidth: 560, maxHeight: '58%', alignSelf: 'center', padding: 16, borderRadius: 22, borderWidth: 1, borderColor: '#454d76', backgroundColor: 'rgba(18,22,34,0.98)', boxShadow: '0px 18px 46px rgba(0,0,0,0.48)' },
  editTutorialTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editTutorialIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,255,0.18)' },
  editTutorialCounter: { color: COLORS.primarySoft, fontSize: 10, fontWeight: '900' },
  editTutorialTitle: { color: COLORS.white, fontSize: 19, fontWeight: '900', marginTop: 10 },
  editTutorialText: { color: COLORS.textSoft, fontSize: 13, lineHeight: 19, marginTop: 6 },
  editTutorialHint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17, marginTop: 7 },
  editTutorialButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, borderRadius: 14, backgroundColor: COLORS.primary },
  editTutorialButtonText: { color: COLORS.white, fontSize: 13, fontWeight: '900' },
  inner: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 120 },
  pageInner: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: 16 },
  center: { flex: 1, backgroundColor: COLORS.dark, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: COLORS.textMuted, fontWeight: '700' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.border },
  topBarCopy: { flex: 1 },
  topBarSpacer: { width: 42 },
  pageEyebrow: { color: COLORS.primarySoft, fontSize: 10, fontWeight: '900', letterSpacing: 1.15 },
  pageTitle: { color: COLORS.white, fontSize: 27, lineHeight: 32, fontWeight: '900', letterSpacing: -0.6, marginTop: 2 },
  profileHero: { minHeight: 190, borderRadius: 28, borderCurve: 'continuous', borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', padding: 22, flexDirection: 'row', alignItems: 'center', gap: 19 },
  heroGlow: { position: 'absolute', width: 240, height: 240, borderRadius: 120, right: -90, top: -120, backgroundColor: 'rgba(124,92,255,0.25)' },
  avatarRing: { width: 112, height: 112, borderRadius: 36, padding: 3, boxShadow: '0px 18px 36px rgba(0,0,0,0.28)' },
  avatarInner: { flex: 1, borderRadius: 33, borderWidth: 3, borderColor: COLORS.darkGray, backgroundColor: COLORS.cardRaised, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  heroCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  heroTitle: { color: COLORS.white, fontSize: 22, lineHeight: 28, fontWeight: '900' },
  heroSubtitle: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  photoButton: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: COLORS.border, marginTop: 13 },
  photoButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '900' },
  videoUploadButton: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(124,92,255,0.42)', backgroundColor: 'rgba(124,92,255,0.07)' },
  videoUploadIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,255,0.17)' },
  videoUploadCopy: { flex: 1 },
  videoUploadTitle: { color: COLORS.white, fontSize: 15, fontWeight: '900' },
  videoUploadText: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  videoList: { gap: 12 },
  sectionCard: { padding: 20, borderRadius: 24, borderCurve: 'continuous', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, boxShadow: '0px 14px 34px rgba(0,0,0,0.14)' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  sectionIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,255,0.15)' },
  sectionCopy: { flex: 1 },
  sectionEyebrow: { color: COLORS.primarySoft, fontSize: 10, fontWeight: '900', letterSpacing: 1.05 },
  sectionTitle: { color: COLORS.white, fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 3 },
  sectionSubtitle: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  sectionBody: { gap: 14, marginTop: 19 },
  fieldWrap: { width: '100%', gap: 7 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  fieldLabel: { color: COLORS.textSoft, fontSize: 12, fontWeight: '800', marginLeft: 2 },
  charCounter: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800' },
  field: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.input, overflow: 'hidden' },
  fieldMultiline: { minHeight: 104, alignItems: 'flex-start' },
  fieldIcon: { marginLeft: 15, marginTop: 1 },
  input: { flex: 1, color: COLORS.white, fontSize: 15, paddingHorizontal: 11, paddingVertical: 14, outlineStyle: 'none' } as any,
  inputMultiline: { minHeight: 102, paddingTop: 15, textAlignVertical: 'top' },
  skillPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  skillChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(124,92,255,0.13)', borderWidth: 1, borderColor: 'rgba(124,92,255,0.28)' },
  skillChipText: { color: COLORS.primarySoft, fontSize: 11, fontWeight: '800' },
  fieldHint: { color: COLORS.lightGray, fontSize: 11, lineHeight: 16 },
  digestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.glass },
  digestIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,255,0.16)' },
  digestCopy: { flex: 1 },
  digestTitle: { color: COLORS.white, fontSize: 15, fontWeight: '900' },
  digestText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  experienceList: { gap: 9 },
  experienceCard: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.border },
  experienceMarker: { width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: COLORS.primary },
  experienceCopy: { flex: 1 },
  experiencePosition: { color: COLORS.white, fontSize: 15, fontWeight: '900' },
  experienceCompany: { color: COLORS.textSoft, fontSize: 12, fontWeight: '700', marginTop: 2 },
  experienceDuration: { color: COLORS.primarySoft, fontSize: 11, fontWeight: '800', marginTop: 6 },
  experienceDescription: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  removeButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.dangerBg },
  addExperienceButton: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(124,92,255,0.42)', backgroundColor: 'rgba(124,92,255,0.07)' },
  addExperienceIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,255,0.17)' },
  addExperienceCopy: { flex: 1 },
  addExperienceTitle: { color: COLORS.white, fontSize: 14, fontWeight: '900' },
  addExperienceText: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  experienceForm: { gap: 14, padding: 16, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(124,92,255,0.30)', backgroundColor: 'rgba(124,92,255,0.06)' },
  experienceFormHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  experienceFormTitle: { color: COLORS.white, fontSize: 16, fontWeight: '900' },
  experienceFormSubtitle: { color: COLORS.textMuted, fontSize: 11, marginTop: 3 },
  closeFormButton: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.glass },
  confirmExperienceButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, backgroundColor: COLORS.primary },
  confirmExperienceText: { color: COLORS.white, fontSize: 14, fontWeight: '900' },
  saveDock: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 17, borderRadius: 22, borderCurve: 'continuous', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardRaised },
  saveCopy: { flex: 1 },
  saveTitle: { color: COLORS.white, fontSize: 15, fontWeight: '900' },
  saveSubtitle: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  saveTouch: { borderRadius: 16, overflow: 'hidden' },
  saveButton: { minHeight: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveButtonText: { color: COLORS.white, fontSize: 14, fontWeight: '900' },
});

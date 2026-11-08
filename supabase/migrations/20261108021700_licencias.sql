-- =============================================================================
-- Licencias de MIP (app móvil)
--
-- Cada cliente es un usuario de Supabase Auth. Las cuentas las crea el
-- administrador (el registro público está desactivado en config.toml); cada
-- cliente tiene UNA licencia, y cada licencia admite una cantidad limitada de
-- dispositivos.
--
-- La app nunca escribe estas tablas directamente: llama a la Edge Function
-- "licencia", que ejecuta activar_dispositivo() con el JWT del cliente y le
-- devuelve un certificado firmado para poder trabajar sin conexión. La
-- administración (crear clientes, suspender, renovar, liberar dispositivos)
-- se hace con `npm run clientes` (scripts/clientes.mjs) o desde el panel de
-- Supabase, siempre con la clave secreta (service_role), que ignora RLS.
-- =============================================================================

create table public.licencias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references auth.users (id) on delete cascade,
  estado text not null default 'activa' check (estado in ('activa', 'suspendida')),
  max_dispositivos integer not null default 1 check (max_dispositivos between 1 and 50),
  -- null = sin vencimiento.
  vence_el timestamptz,
  notas text,
  creada_el timestamptz not null default now(),
  actualizada_el timestamptz not null default now()
);

comment on table public.licencias is
  'Licencia de cada cliente de MIP. Solo la modifica el administrador.';

create table public.dispositivos (
  id uuid primary key default gen_random_uuid(),
  licencia_id uuid not null references public.licencias (id) on delete cascade,
  -- Mismo formato que muestra la app (Ajustes > Licencia): 12 caracteres
  -- hexadecimales en mayúsculas, en grupos de 4.
  codigo text not null check (codigo ~ '^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$'),
  nombre text check (char_length(nombre) <= 100),
  -- Bloqueado por el administrador (por ejemplo, un teléfono robado): ya no
  -- puede renovar su certificado y deja de ocupar lugar en el límite.
  bloqueado boolean not null default false,
  activado_el timestamptz not null default now(),
  ultimo_contacto_el timestamptz not null default now(),
  unique (licencia_id, codigo)
);

comment on table public.dispositivos is
  'Teléfonos registrados en cada licencia. Los da de alta activar_dispositivo().';

create function public.tocar_actualizada_el()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizada_el := now();
  return new;
end;
$$;

create trigger licencias_actualizada_el
  before update on public.licencias
  for each row execute function public.tocar_actualizada_el();

revoke all on function public.tocar_actualizada_el() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Permisos y RLS: el cliente solo puede LEER su propia licencia y sus propios
-- dispositivos. No hay políticas de escritura, así que con la clave publicable
-- (la que va dentro del APK) nadie puede crearse, extenderse ni reactivarse
-- una licencia.
-- -----------------------------------------------------------------------------

alter table public.licencias enable row level security;
alter table public.dispositivos enable row level security;

revoke all on table public.licencias, public.dispositivos from anon, authenticated;
grant select on table public.licencias, public.dispositivos to authenticated;
grant all on table public.licencias, public.dispositivos to service_role;

create policy "licencias: cada cliente ve la suya"
  on public.licencias
  for select
  to authenticated
  using (usuario_id = (select auth.uid()));

create policy "dispositivos: cada cliente ve los suyos"
  on public.dispositivos
  for select
  to authenticated
  using (
    licencia_id in (
      select l.id from public.licencias l where l.usuario_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- activar_dispositivo: registra (o vuelve a confirmar) el teléfono del cliente
-- que llama, respetando el estado, el vencimiento y el límite de dispositivos
-- de su licencia. SECURITY DEFINER porque el cliente no tiene permiso de
-- escritura sobre las tablas; el usuario sale siempre de auth.uid() (el JWT),
-- nunca de un parámetro.
--
-- Llamarla directo (sin pasar por la Edge Function) no sirve para nada más que
-- ocupar un lugar de la propia licencia: el certificado que habilita la app lo
-- firma solo la Edge Function.
-- -----------------------------------------------------------------------------

create function public.activar_dispositivo(p_codigo text, p_nombre text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_licencia public.licencias%rowtype;
  v_bloqueado boolean;
  v_en_uso integer;
begin
  if v_usuario is null then
    raise exception 'no_autenticado' using errcode = '28000';
  end if;

  if p_codigo is null or p_codigo !~ '^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' then
    return jsonb_build_object('ok', false, 'codigo', 'dispositivo_invalido');
  end if;

  -- FOR UPDATE: si dos teléfonos activan la misma licencia a la vez, se
  -- atienden de a uno, así no pueden pasarse juntos del límite.
  select * into v_licencia
    from public.licencias
   where usuario_id = v_usuario
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'sin_licencia');
  end if;

  if v_licencia.estado <> 'activa' then
    return jsonb_build_object('ok', false, 'codigo', 'licencia_suspendida');
  end if;

  if v_licencia.vence_el is not null and v_licencia.vence_el <= now() then
    return jsonb_build_object(
      'ok', false,
      'codigo', 'licencia_vencida',
      'vence_el', v_licencia.vence_el
    );
  end if;

  select bloqueado into v_bloqueado
    from public.dispositivos
   where licencia_id = v_licencia.id
     and codigo = p_codigo;

  if found then
    if v_bloqueado then
      return jsonb_build_object('ok', false, 'codigo', 'dispositivo_bloqueado');
    end if;

    update public.dispositivos
       set ultimo_contacto_el = now(),
           nombre = coalesce(left(p_nombre, 100), nombre)
     where licencia_id = v_licencia.id
       and codigo = p_codigo;
  else
    select count(*) into v_en_uso
      from public.dispositivos
     where licencia_id = v_licencia.id
       and not bloqueado;

    if v_en_uso >= v_licencia.max_dispositivos then
      return jsonb_build_object(
        'ok', false,
        'codigo', 'limite_dispositivos',
        'max_dispositivos', v_licencia.max_dispositivos
      );
    end if;

    insert into public.dispositivos (licencia_id, codigo, nombre)
    values (v_licencia.id, p_codigo, left(p_nombre, 100));
  end if;

  return jsonb_build_object(
    'ok', true,
    'licencia_id', v_licencia.id,
    'vence_el', v_licencia.vence_el,
    'max_dispositivos', v_licencia.max_dispositivos,
    'dispositivos_en_uso', (
      select count(*)
        from public.dispositivos
       where licencia_id = v_licencia.id
         and not bloqueado
    )
  );
end;
$$;

revoke all on function public.activar_dispositivo(text, text) from public, anon;
grant execute on function public.activar_dispositivo(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- liberar_dispositivo: al cerrar sesión, la app libera el lugar que ocupaba
-- este teléfono en la licencia, para poder entrar desde otro sin pedirle nada
-- al administrador. Un dispositivo bloqueado no se puede liberar (seguiría
-- bloqueado si vuelve a entrar).
-- -----------------------------------------------------------------------------

create function public.liberar_dispositivo(p_codigo text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_borrados integer;
begin
  delete from public.dispositivos d
   using public.licencias l
   where d.licencia_id = l.id
     and l.usuario_id = auth.uid()
     and d.codigo = p_codigo
     and not d.bloqueado;

  get diagnostics v_borrados = row_count;
  return v_borrados > 0;
end;
$$;

revoke all on function public.liberar_dispositivo(text) from public, anon;
grant execute on function public.liberar_dispositivo(text) to authenticated;
